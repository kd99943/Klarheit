package com.klarheit.backend;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.klarheit.backend.aftersales.AfterSalesTicketRepository;
import com.klarheit.backend.audit.AuditLogService;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.email.EmailNotificationLog;
import com.klarheit.backend.email.EmailNotificationLogRepository;
import com.klarheit.backend.email.EmailService;
import com.klarheit.backend.order.AdminController;
import com.klarheit.backend.order.BusinessClock;
import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderRepository;
import com.klarheit.backend.order.OrderService;
import com.klarheit.backend.order.OrderStatus;
import com.klarheit.backend.payment.PaymentReconciliationScheduler;
import com.klarheit.backend.payment.RefundStatus;
import com.klarheit.backend.payment.RefundTransaction;
import com.klarheit.backend.payment.RefundTransactionRepository;
import com.klarheit.backend.product.ProductService;
import com.klarheit.backend.security.StaffRoles;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.client.RestClient;

@ExtendWith(MockitoExtension.class)
class ProductionReadinessP1Test {

    @Mock private OrderRepository orderRepository;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private ProductService productService;
    @Mock private AuditLogService auditLogService;
    @Mock private OrderService orderService;
    @Mock private RefundTransactionRepository refundTransactionRepository;
    @Mock private AfterSalesTicketRepository afterSalesTicketRepository;
    @Mock private EmailNotificationLogRepository notificationLogRepository;

    private AdminController adminController;
    private EmailService emailService;

    @BeforeEach
    void setUp() {
        adminController = new AdminController(
                orderRepository, userAccountRepository, productService, auditLogService, orderService, null);
        adminController.setRefundTransactionRepository(refundTransactionRepository);
        adminController.setAfterSalesTicketRepository(afterSalesTicketRepository);

        emailService = new EmailService(RestClient.builder(), "", "orders@klarheit.com");
        emailService.setNotificationLogRepository(notificationLogRepository);
        adminController.setEmailService(emailService);
    }

    @Test
    void emailOutboxDeduplicatesSentEventsAndResendsFailedIdempotently() {
        AtomicReference<EmailNotificationLog> storedOrderConfirm = new AtomicReference<>();
        when(notificationLogRepository.findByEventKey("ORDER_CONFIRMATION:KL-OUTBOX-1"))
                .thenAnswer(inv -> Optional.ofNullable(storedOrderConfirm.get()));
        when(notificationLogRepository.save(any(EmailNotificationLog.class))).thenAnswer(inv -> {
            EmailNotificationLog entry = inv.getArgument(0);
            if ("ORDER_CONFIRMATION:KL-OUTBOX-1".equals(entry.getEventKey())) {
                storedOrderConfirm.set(entry);
            }
            return entry;
        });

        // 1. First send records SENT with attemptCount = 1
        emailService.sendOrderConfirmation("lin@example.com", "KL-OUTBOX-1", "AERO X1", "1180.00");
        assertNotNull(storedOrderConfirm.get());
        assertEquals(EmailNotificationLog.STATUS_SENT, storedOrderConfirm.get().getStatus());
        assertEquals(1, storedOrderConfirm.get().getAttemptCount());

        // 2. Duplicate call with same eventKey skips sending
        emailService.sendOrderConfirmation("lin@example.com", "KL-OUTBOX-1", "AERO X1", "1180.00");
        assertEquals(1, storedOrderConfirm.get().getAttemptCount());

        // 3. @Recover records FAILED status in outbox
        AtomicReference<EmailNotificationLog> failedShipping = new AtomicReference<>();
        when(notificationLogRepository.findByEventKey("SHIPPING:KL-OUTBOX-1:SF999"))
                .thenAnswer(inv -> Optional.ofNullable(failedShipping.get()));
        when(notificationLogRepository.save(any(EmailNotificationLog.class))).thenAnswer(inv -> {
            EmailNotificationLog entry = inv.getArgument(0);
            if ("SHIPPING:KL-OUTBOX-1:SF999".equals(entry.getEventKey())) {
                if (entry.getId() == null) entry.setId(42L);
                failedShipping.set(entry);
            }
            return entry;
        });

        emailService.recoverSendShippingNotification(
                new RuntimeException("SMTP 503"), "lin@example.com", "KL-OUTBOX-1", "AERO X1", "SF Express", "SF999");
        assertNotNull(failedShipping.get());
        assertEquals(EmailNotificationLog.STATUS_FAILED, failedShipping.get().getStatus());
        assertEquals("SMTP 503", failedShipping.get().getLastError());
        assertEquals(1, failedShipping.get().getAttemptCount());

        // 4. Operator resend transitions FAILED -> SENT
        when(notificationLogRepository.findById(42L)).thenAnswer(inv -> Optional.ofNullable(failedShipping.get()));
        EmailNotificationLog resent = emailService.resendNotification(42L, "cs@klarheit.com");
        assertEquals(EmailNotificationLog.STATUS_SENT, resent.getStatus());
        assertEquals("cs@klarheit.com", resent.getResentBy());
        assertEquals(2, resent.getAttemptCount());
        assertNull(resent.getLastError());

        // 5. Repeat resend on already-SENT entry is a no-op (idempotent!)
        EmailNotificationLog secondResend = emailService.resendNotification(42L, "cs@klarheit.com");
        assertEquals(EmailNotificationLog.STATUS_SENT, secondResend.getStatus());
        assertEquals(2, secondResend.getAttemptCount());
    }

    @Test
    void schedulerSendsProactiveHoldExpiryReminderAndStampsOrder() {
        EmailService mockEmail = mock(EmailService.class);
        PaymentReconciliationScheduler scheduler = new PaymentReconciliationScheduler(orderRepository, orderService);
        scheduler.setEmailService(mockEmail);

        LocalDateTime now = BusinessClock.now();
        Order quoteExpiringSoon = Order.builder()
                .orderNumber("KL-REMIND-1")
                .customerEmail("buyer@example.com")
                .status(OrderStatus.QUOTE_READY)
                .quoteExpiresAt(now.plusHours(6))
                .build();

        when(orderRepository.findExpiredOrders(any())).thenReturn(List.of());
        when(orderRepository.findExpiredAwaitingReviewOrders(any(), any())).thenReturn(List.of());
        when(orderRepository.findExpiredQuoteReadyOrders(any(), any())).thenReturn(List.of());
        when(orderRepository.findCancelRequestedOrders()).thenReturn(List.of());
        when(orderRepository.findByStatus(OrderStatus.REFUND_PENDING)).thenReturn(List.of());
        when(orderRepository.findOrdersNeedingExpiryReminder(any(), any(), any()))
                .thenReturn(List.of(quoteExpiringSoon));

        scheduler.cleanExpiredOrders();

        verify(mockEmail).sendHoldExpiryReminder(
                eq("buyer@example.com"),
                eq("KL-REMIND-1"),
                eq(OrderStatus.QUOTE_READY),
                eq(quoteExpiringSoon.getQuoteExpiresAt()));
        assertNotNull(quoteExpiringSoon.getExpiryReminderSentAt());
        verify(orderRepository).save(quoteExpiringSoon);
    }

    @Test
    @SuppressWarnings("unchecked")
    void adminAlertsAggregatesAllSixSignalsWithOwnerRolesWithoutFullTableScan() {
        LocalDateTime now = BusinessClock.now();
        LocalDate yesterday = BusinessClock.today().minusDays(1);

        Order awaiting = Order.builder()
                .orderNumber("KL-AL-1").status(OrderStatus.AWAITING_REVIEW)
                .reviewExpiresAt(now.minusHours(1)).build();
        Order delayed = Order.builder()
                .orderNumber("KL-AL-2").status(OrderStatus.PAID)
                .initialPromisedDeliveryDate(yesterday).build();
        Order refundPending = Order.builder()
                .orderNumber("KL-AL-3").status(OrderStatus.REFUND_PENDING).build();

        when(orderRepository.findByStatus(OrderStatus.AWAITING_REVIEW)).thenReturn(List.of(awaiting));
        when(orderRepository.findByStatus(OrderStatus.QUOTE_READY)).thenReturn(List.of());
        when(orderRepository.findByStatus(OrderStatus.CREATED)).thenReturn(List.of());
        when(orderRepository.findByStatus(OrderStatus.PENDING_PAYMENT)).thenReturn(List.of());
        when(orderRepository.findByStatus(OrderStatus.PAID)).thenReturn(List.of(delayed));
        when(orderRepository.findByStatus(OrderStatus.SHIPPED)).thenReturn(List.of());
        when(orderRepository.findByStatus(OrderStatus.REFUND_PENDING)).thenReturn(List.of(refundPending));

        RefundTransaction failedTx = new RefundTransaction();
        failedTx.setOrderNumber("KL-AL-4");
        failedTx.setRefundRequestId("RF-AL-4");
        failedTx.setStatus(RefundStatus.FAILED);
        when(refundTransactionRepository.findByStatusIn(any())).thenReturn(List.of(failedTx));
        when(notificationLogRepository.countByStatus(EmailNotificationLog.STATUS_FAILED)).thenReturn(3L);
        when(afterSalesTicketRepository.countOverdueOpenTickets(any())).thenReturn(2L);

        Map<String, Object> body = adminController.getOperationalAlerts().getBody();
        assertNotNull(body);
        assertEquals(10L, body.get("totalActionable")); // 1 awaiting + 1 expired + 1 delayed + 2 refunds + 3 emails + 2 tickets
        List<Map<String, Object>> alerts = (List<Map<String, Object>>) body.get("alerts");
        assertEquals(6, alerts.size());

        Map<String, Map<String, Object>> byKey = new java.util.HashMap<>();
        alerts.forEach(a -> byKey.put(String.valueOf(a.get("key")), a));

        assertEquals(1L, byKey.get("AWAITING_REVIEW").get("count"));
        assertEquals(StaffRoles.OPTICIAN, byKey.get("AWAITING_REVIEW").get("ownerRole"));
        assertEquals(1L, byKey.get("EXPIRED_HOLDS").get("count"));
        assertEquals(1L, byKey.get("DELAYED_DELIVERY").get("count"));
        assertEquals(StaffRoles.WAREHOUSE, byKey.get("DELAYED_DELIVERY").get("ownerRole"));
        assertEquals(2L, byKey.get("UNRESOLVED_REFUNDS").get("count"));
        assertEquals(StaffRoles.FINANCE, byKey.get("UNRESOLVED_REFUNDS").get("ownerRole"));
        assertEquals(3L, byKey.get("FAILED_EMAILS").get("count"));
        assertEquals(StaffRoles.CUSTOMER_SERVICE, byKey.get("FAILED_EMAILS").get("ownerRole"));
        assertEquals(2L, byKey.get("OVERDUE_AFTER_SALES").get("count"));

        verify(orderRepository, never()).findAll();
    }

    @Test
    void adminResendNotificationLogsAuditAndPeriodExportUsesIndexedQueriesOnly() {
        EmailNotificationLog entry = new EmailNotificationLog();
        entry.setId(7L);
        entry.setEventKey("ORDER_CONFIRMATION:KL-RS-1");
        entry.setEventType("ORDER_CONFIRMATION");
        entry.setOrderNumber("KL-RS-1");
        entry.setRecipientEmail("lin@example.com");
        entry.setSubject("Order Confirmed");
        entry.setBodyHtml("<p>ok</p>");
        entry.setStatus(EmailNotificationLog.STATUS_FAILED);
        entry.setAttemptCount(1);

        when(notificationLogRepository.findById(7L)).thenReturn(Optional.of(entry));
        when(notificationLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Authentication auth = new UsernamePasswordAuthenticationToken("cs@klarheit.com", "pw");
        EmailNotificationLog resent = adminController.resendEmailNotification(7L, auth).getBody();
        assertNotNull(resent);
        assertEquals(EmailNotificationLog.STATUS_SENT, resent.getStatus());
        verify(auditLogService).log(eq("cs@klarheit.com"), eq("RESEND_EMAIL"), eq("NOTIFICATION"), eq("7"), contains("SENT"));

        // Verify period-scoped reconciliation CSV export uses indexed repository methods and NEVER findAll()
        LocalDate day = LocalDate.of(2026, 11, 22);
        Order paidOrder = Order.builder()
                .orderNumber("KL-IDX-1")
                .status(OrderStatus.PAID)
                .totalAmount(new BigDecimal("1180.00"))
                .paidAt(day.atTime(12, 0))
                .createdAt(day.atTime(11, 50))
                .build();
        when(orderRepository.findPaidOrdersInPeriod(any(), any())).thenReturn(List.of(paidOrder));
        when(refundTransactionRepository.findConfirmedRefundsInPeriod(any(), any())).thenReturn(List.of());
        when(afterSalesTicketRepository.findByOrderNumberIn(any())).thenReturn(List.of());

        String csv = new String(
                adminController.exportReconciliationCsv("2026-11-22", "2026-11-22").getBody(),
                StandardCharsets.UTF_8);
        assertTrue(csv.contains("KL-IDX-1"));
        verify(orderRepository, never()).findAll();
        verify(refundTransactionRepository, never()).findAll();
        verify(afterSalesTicketRepository, never()).findAll();
    }
}
