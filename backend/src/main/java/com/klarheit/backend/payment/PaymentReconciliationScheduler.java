package com.klarheit.backend.payment;

import com.klarheit.backend.aftersales.AfterSalesService;
import com.klarheit.backend.email.EmailService;
import com.klarheit.backend.order.BusinessClock;
import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderRepository;
import com.klarheit.backend.order.OrderService;
import com.klarheit.backend.order.OrderStatus;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
        name = "app.payment.reconciliation-scheduler-enabled",
        havingValue = "true",
        matchIfMissing = false
)
public class PaymentReconciliationScheduler {

    private final OrderRepository orderRepository;
    private final OrderService orderService;

    @Autowired(required = false)
    private RefundTransactionRepository refundTransactionRepository;

    @Autowired(required = false)
    private AfterSalesService afterSalesService;

    @Autowired(required = false)
    private EmailService emailService;

    public PaymentReconciliationScheduler(OrderRepository orderRepository, OrderService orderService) {
        this.orderRepository = orderRepository;
        this.orderService = orderService;
    }

    public void setRefundTransactionRepository(RefundTransactionRepository refundTransactionRepository) {
        this.refundTransactionRepository = refundTransactionRepository;
    }

    public void setAfterSalesService(AfterSalesService afterSalesService) {
        this.afterSalesService = afterSalesService;
    }

    public void setEmailService(EmailService emailService) {
        this.emailService = emailService;
    }

    /**
     * P0-02 & P0-06:
     * 1. Reconcile expired CREATED/PENDING_PAYMENT orders (30m), expired AWAITING_REVIEW holds (48h),
     *    expired QUOTE_READY holds (72h), and cancel-requested orders.
     * 2. Retry REFUND_PENDING orders AND any itemized FAILED/PENDING_CHANNEL refund transactions
     *    (including partial post-shipment refunds on SHIPPED/DELIVERED orders!).
     */
    @Scheduled(cron = "0 */5 * * * *")
    public void cleanExpiredOrders() {
        log.info("Starting scheduled reconciliation job for expired holds and pending/failed refunds...");
        LocalDateTime now = BusinessClock.now();
        LocalDateTime paymentCutoff = now.minusMinutes(OrderService.DEFAULT_PAYMENT_HOLD_MINUTES);
        LocalDateTime reviewFallbackCutoff = now.minusHours(OrderService.DEFAULT_REVIEW_HOLD_HOURS);
        LocalDateTime quoteFallbackCutoff = now.minusHours(OrderService.DEFAULT_QUOTE_HOLD_HOURS);

        Set<String> reconciledOrderNumbers = new LinkedHashSet<>();
        addOrders(reconciledOrderNumbers, orderRepository.findExpiredOrders(paymentCutoff));
        addOrders(reconciledOrderNumbers, orderRepository.findExpiredAwaitingReviewOrders(now, reviewFallbackCutoff));
        addOrders(reconciledOrderNumbers, orderRepository.findExpiredQuoteReadyOrders(now, quoteFallbackCutoff));
        addOrders(reconciledOrderNumbers, orderRepository.findCancelRequestedOrders());

        log.info("Found {} unpaid/review/quote orders to reconcile.", reconciledOrderNumbers.size());
        for (String orderNumber : reconciledOrderNumbers) {
            try {
                orderService.cancelExpiredOrder(orderNumber);
            } catch (Exception e) {
                log.error("Failed to reconcile expired order: {}", orderNumber, e);
            }
        }

        // Retry legacy/order-level REFUND_PENDING orders
        List<Order> pendingRefundOrders = orderRepository.findByStatus(OrderStatus.REFUND_PENDING);
        if (pendingRefundOrders != null && !pendingRefundOrders.isEmpty()) {
            log.info("Found {} orders in REFUND_PENDING status to retry.", pendingRefundOrders.size());
            for (Order order : pendingRefundOrders) {
                try {
                    orderService.retryPendingRefund(order.getOrderNumber());
                } catch (Exception e) {
                    log.error("Failed to retry refund for order: {}", order.getOrderNumber(), e);
                }
            }
        }

        // P0-06: Retry itemized FAILED / PENDING_CHANNEL partial or post-shipment refund transactions
        if (refundTransactionRepository != null && afterSalesService != null) {
            List<RefundTransaction> pendingTxs = refundTransactionRepository
                    .findByStatusIn(List.of(RefundStatus.PENDING_CHANNEL, RefundStatus.FAILED));
            if (pendingTxs != null && !pendingTxs.isEmpty()) {
                log.info("Found {} itemized refund transactions to retry.", pendingTxs.size());
                for (RefundTransaction tx : pendingTxs) {
                    if (tx.getTicketNumber() == null) {
                        continue; // Cancelled-order refunds handled above via retryPendingRefund
                    }
                    try {
                        afterSalesService.retryRefundTransaction(tx.getRefundRequestId(), "scheduler");
                    } catch (Exception e) {
                        log.error("Failed to retry itemized refund transaction: {}", tx.getRefundRequestId(), e);
                    }
                }
            }
        }

        // P0-02: Send proactive hold-expiry reminder once (12h before review deadline, 24h before quote deadline)
        if (emailService != null) {
            List<Order> reminderCandidates = orderRepository.findOrdersNeedingExpiryReminder(
                    now, now.plusHours(12), now.plusHours(24));
            if (reminderCandidates != null && !reminderCandidates.isEmpty()) {
                for (Order order : reminderCandidates) {
                    try {
                        LocalDateTime deadline = OrderStatus.QUOTE_READY.equalsIgnoreCase(order.getStatus())
                                ? order.getQuoteExpiresAt()
                                : order.getReviewExpiresAt();
                        emailService.sendHoldExpiryReminder(
                                order.getCustomerEmail(), order.getOrderNumber(), order.getStatus(), deadline);
                        order.setExpiryReminderSentAt(now);
                        orderRepository.save(order);
                    } catch (Exception e) {
                        log.error("Failed to send hold expiry reminder for order: {}", order.getOrderNumber(), e);
                    }
                }
            }
        }

        log.info("Scheduled reconciliation job completed.");
    }

    private void addOrders(Set<String> target, List<Order> list) {
        if (list == null) return;
        for (Order order : list) {
            if (order != null && order.getOrderNumber() != null) {
                target.add(order.getOrderNumber());
            }
        }
    }
}
