package com.klarheit.backend;

import com.klarheit.backend.aftersales.AfterSalesService;
import com.klarheit.backend.aftersales.AfterSalesTicket;
import com.klarheit.backend.aftersales.AfterSalesTicketRepository;
import com.klarheit.backend.aftersales.dto.AfterSalesTicketResponseDTO;
import com.klarheit.backend.aftersales.dto.AfterSalesTicketUpdateDTO;
import com.klarheit.backend.audit.AuditLogService;
import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.auth.UserService;
import com.klarheit.backend.coupon.CouponService;
import com.klarheit.backend.email.EmailService;
import com.klarheit.backend.lens.LensOption;
import com.klarheit.backend.lens.LensOptionRepository;
import com.klarheit.backend.order.AdminController;
import com.klarheit.backend.order.FulfillmentStatus;
import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderRepository;
import com.klarheit.backend.order.OrderService;
import com.klarheit.backend.order.OrderStatus;
import com.klarheit.backend.order.dto.CustomerInfoDTO;
import com.klarheit.backend.order.dto.OrderDetailResponseDTO;
import com.klarheit.backend.order.dto.OrderRequestDTO;
import com.klarheit.backend.order.dto.OrderResponseDTO;
import com.klarheit.backend.order.dto.PrescriptionDetailsDTO;
import com.klarheit.backend.payment.PaymentInitiateResult;
import com.klarheit.backend.payment.PaymentService;
import com.klarheit.backend.prescription.Prescription;
import com.klarheit.backend.prescription.PrescriptionRepository;
import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductRepository;
import com.klarheit.backend.product.ProductSalesStatus;
import com.klarheit.backend.product.ProductService;
import com.klarheit.backend.product.ProductSku;
import com.klarheit.backend.product.ProductSkuRepository;
import com.klarheit.backend.product.dto.ProductSkuDTO;
import com.klarheit.backend.product.dto.ProductSkuUpsertDTO;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BusinessOperationsTest {

    @Mock private ProductRepository productRepository;
    @Mock private ProductSkuRepository productSkuRepository;
    @Mock private LensOptionRepository lensOptionRepository;
    @Mock private PrescriptionRepository prescriptionRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private UserService userService;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private EmailService emailService;
    @Mock private CouponService couponService;
    @Mock private PaymentService paymentService;
    @Mock private AfterSalesTicketRepository afterSalesTicketRepository;
    @Mock private AuditLogService auditLogService;

    private OrderService orderService;
    private ProductService productService;
    private AfterSalesService afterSalesService;
    private AdminController adminController;

    private Product aeroProduct;
    private UserAccount customer;
    private LensOption lens156;
    private LensOption lens174;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(
                productRepository, lensOptionRepository, prescriptionRepository,
                orderRepository, userService, emailService, couponService, paymentService
        );
        orderService.setProductSkuRepository(productSkuRepository);

        productService = new ProductService(productRepository);
        productService.setProductSkuRepository(productSkuRepository);

        afterSalesService = new AfterSalesService(
                afterSalesTicketRepository, orderRepository, userService, auditLogService
        );
        afterSalesService.setPaymentService(paymentService);
        afterSalesService.setProductSkuRepository(productSkuRepository);
        afterSalesService.setProductRepository(productRepository);

        adminController = new AdminController(
                orderRepository, userAccountRepository, productService,
                auditLogService, orderService, couponService
        );
        ReflectionTestUtils.setField(adminController, "afterSalesTicketRepository", afterSalesTicketRepository);

        aeroProduct = Product.builder()
                .id(1L).name("AERO X1").nameEn("AERO X1").nameZh("AERO X1")
                .material("Titanium").materialEn("Titanium").materialZh("钛金属")
                .basePrice(new BigDecimal("850.00")).imageUrl("/images/aero.png")
                .shape("ROUND").specsSize("54-17-140").stockQuantity(10)
                .salesStatus(ProductSalesStatus.AVAILABLE)
                .build();

        customer = UserAccount.builder()
                .id(7L).firstName("Lin").lastName("Wei").email("lin@example.com")
                .phone("13800138000").role("USER").build();

        lens156 = LensOption.builder().id(1L).type("STANDARD_156").category("LENS")
                .label("1.56 Standard").additionalPrice(BigDecimal.ZERO).build();
        lens174 = LensOption.builder().id(4L).type("HIGH_INDEX_174").category("LENS")
                .label("1.74 High-Index").additionalPrice(new BigDecimal("215.00")).build();
    }

    @Test
    void skuInventoryAllowsMatteBlackWhileSilverSoldOutAndPreventsConcurrentLastPairOversell() {
        ProductSku silverSoldOut = new ProductSku();
        silverSoldOut.setId(101L);
        silverSoldOut.setProduct(aeroProduct);
        silverSoldOut.setFinishId("titanium");
        silverSoldOut.setSizeSpec("54-17-140");
        silverSoldOut.setOnHandQty(1);
        silverSoldOut.setReservedQty(1); // 0 available
        silverSoldOut.setSalesStatus(ProductSalesStatus.AVAILABLE);
        silverSoldOut.setRestockEta(LocalDate.now().plusDays(7));

        ProductSku matteBlackLastOne = new ProductSku();
        matteBlackLastOne.setId(102L);
        matteBlackLastOne.setProduct(aeroProduct);
        matteBlackLastOne.setFinishId("matte-black");
        matteBlackLastOne.setSizeSpec("54-17-140");
        matteBlackLastOne.setOnHandQty(1);
        matteBlackLastOne.setReservedQty(0); // 1 available
        matteBlackLastOne.setSalesStatus(ProductSalesStatus.AVAILABLE);

        PrescriptionDetailsDTO normalRx = new PrescriptionDetailsDTO(
                new BigDecimal("-2.00"), new BigDecimal("-2.00"),
                BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, new BigDecimal("63.0"));
        CustomerInfoDTO info = new CustomerInfoDTO("Lin", "Wei", "lin@example.com", "Shanghai 88");

        when(productRepository.findById(1L)).thenReturn(Optional.of(aeroProduct));
        when(userService.findByEmailIgnoreCase("lin@example.com")).thenReturn(Optional.of(customer));

        // 1. Silver sold out -> rejected with restock ETA notice
        when(productSkuRepository.findByProductIdAndFinishIdAndSizeSpec(1L, "titanium", "54-17-140"))
                .thenReturn(Optional.of(silverSoldOut));
        OrderRequestDTO silverReq = new OrderRequestDTO(
                1L, List.of("STANDARD_156"), info, normalRx, null, "ALIPAY", "titanium");
        IllegalStateException soldOutEx = assertThrows(IllegalStateException.class,
                () -> orderService.checkout(silverReq, "lin@example.com"));
        assertTrue(soldOutEx.getMessage().contains("缺货"));

        // 2. Matte black has 1 available -> first buyer succeeds, second concurrent buyer fails atomic reserve
        when(productSkuRepository.findByProductIdAndFinishIdAndSizeSpec(1L, "matte-black", "54-17-140"))
                .thenReturn(Optional.of(matteBlackLastOne));
        when(lensOptionRepository.findByTypeIn(List.of("STANDARD_156"))).thenReturn(List.of(lens156));
        when(prescriptionRepository.save(any(Prescription.class))).thenAnswer(inv -> inv.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        when(paymentService.initiatePayment(anyString(), any(), eq("ALIPAY")))
                .thenReturn(new PaymentInitiateResult("TX-1", "<form></form>"));
        when(productSkuRepository.reserveStockIfAvailable(102L)).thenReturn(1, 0);

        OrderRequestDTO blackReq = new OrderRequestDTO(
                1L, List.of("STANDARD_156"), info, normalRx, null, "ALIPAY", "matte-black");

        OrderResponseDTO firstBuyer = orderService.checkout(blackReq, "lin@example.com");
        assertEquals(OrderStatus.PENDING_PAYMENT, firstBuyer.status());

        IllegalStateException raceEx = assertThrows(IllegalStateException.class,
                () -> orderService.checkout(blackReq, "lin@example.com"));
        assertTrue(raceEx.getMessage().contains("售罄"));
    }

    @Test
    void upsertSkuUpdatesInventoryAndSyncsAggregateProductStock() {
        when(productRepository.findById(1L)).thenReturn(Optional.of(aeroProduct));
        when(productSkuRepository.findByProductIdAndFinishIdAndSizeSpec(1L, "titanium", "54-17-140"))
                .thenReturn(Optional.empty());
        when(productSkuRepository.save(any(ProductSku.class))).thenAnswer(inv -> {
            ProductSku s = inv.getArgument(0);
            s.setId(201L);
            return s;
        });
        ProductSku savedSku = new ProductSku();
        savedSku.setId(201L);
        savedSku.setProduct(aeroProduct);
        savedSku.setFinishId("titanium");
        savedSku.setSizeSpec("54-17-140");
        savedSku.setOnHandQty(6);
        savedSku.setReservedQty(1);
        savedSku.setSalesStatus(ProductSalesStatus.AVAILABLE);
        when(productSkuRepository.findByProductIdOrderByIdAsc(1L)).thenReturn(List.of(savedSku));

        ProductSkuDTO dto = productService.upsertSku(1L, new ProductSkuUpsertDTO(
                "titanium", "54-17-140", "Danyang Optical Co", 6, "AVAILABLE",
                LocalDate.now().plusDays(10), new BigDecimal("260.00")
        ));

        assertEquals("Danyang Optical Co", dto.supplierName());
        assertEquals(6, dto.onHandQty());
        assertEquals(5, aeroProduct.getStockQuantity()); // synced to available qty (6 - 1)
    }

    @Test
    void highPowerRxEntersAwaitingReviewWithoutPaymentUntilOpticianQuotesAndCustomerConfirms() {
        PrescriptionDetailsDTO highRx = new PrescriptionDetailsDTO(
                new BigDecimal("-9.50"), new BigDecimal("-8.75"),
                new BigDecimal("-1.00"), new BigDecimal("-0.50"),
                90, 90, new BigDecimal("63.0"));
        CustomerInfoDTO info = new CustomerInfoDTO("Lin", "Wei", "lin@example.com", "Shanghai 88");

        when(productRepository.findById(1L)).thenReturn(Optional.of(aeroProduct));
        when(productSkuRepository.findByProductIdOrderByIdAsc(1L)).thenReturn(List.of());
        when(productRepository.decrementStockIfAvailable(1L)).thenReturn(1);
        when(userService.findByEmailIgnoreCase("lin@example.com")).thenReturn(Optional.of(customer));
        when(lensOptionRepository.findByTypeIn(List.of("HIGH_INDEX_174"))).thenReturn(List.of(lens174));
        when(prescriptionRepository.save(any(Prescription.class))).thenAnswer(inv -> inv.getArgument(0));

        Order[] stored = new Order[1];
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            stored[0] = inv.getArgument(0);
            return stored[0];
        });

        OrderRequestDTO req = new OrderRequestDTO(
                1L, List.of("HIGH_INDEX_174"), info, highRx, null, "ALIPAY", "titanium");

        // 1. Checkout blocks payment gateway & puts order in AWAITING_REVIEW (no delivery date locked yet)
        OrderResponseDTO created = orderService.checkout(req, "lin@example.com");
        assertEquals(OrderStatus.AWAITING_REVIEW, created.status());
        assertNull(created.payData());
        verifyNoInteractions(paymentService);
        assertNull(stored[0].getInitialPromisedDeliveryDate());

        // 2. Optician confirms revised plan, quote & initial promised date -> QUOTE_READY locks initialPromisedDeliveryDate
        LocalDate initialPromised = LocalDate.now().plusDays(12);
        LocalDate revisedPromised = initialPromised.plusDays(4);
        when(orderRepository.findByOrderNumberWithWriteLock(created.orderNumber())).thenReturn(Optional.of(stored[0]));
        when(orderRepository.findByOrderNumber(created.orderNumber())).thenReturn(Optional.of(stored[0]));

        OrderDetailResponseDTO quoted = orderService.adminConfirmPrepayQuote(
                created.orderNumber(),
                new BigDecimal("1180.00"),
                initialPromised,
                "建议采用定制 1.74 非球面高弯镜片，预计 12 天交付",
                "optician@klarheit.com"
        );
        assertEquals(OrderStatus.QUOTE_READY, quoted.status());
        assertEquals(new BigDecimal("1180.00"), quoted.quoteRevisedAmount());
        assertEquals(initialPromised, quoted.initialPromisedDeliveryDate());
        assertEquals(initialPromised, quoted.estimatedDeliveryDate());

        // 2b. Subsequent quote date revision must NOT overwrite immutable initialPromisedDeliveryDate
        OrderDetailResponseDTO rescheduled = orderService.adminConfirmPrepayQuote(
                created.orderNumber(),
                new BigDecimal("1180.00"),
                revisedPromised,
                "高弯定制加工排期顺延 4 天",
                "optician@klarheit.com"
        );
        assertEquals(initialPromised, rescheduled.initialPromisedDeliveryDate()); // immutable!
        assertEquals(revisedPromised, rescheduled.estimatedDeliveryDate());

        // 3. Stale quote version (v1) is rejected with QuoteVersionConflictException; accepting v2 opens payment gateway
        assertThrows(com.klarheit.backend.order.QuoteVersionConflictException.class,
                () -> orderService.customerConfirmQuoteAndPay(created.orderNumber(), "lin@example.com", "ALIPAY", quoted.quoteVersion()));

        when(paymentService.initiatePayment(created.orderNumber(), new BigDecimal("1180.00"), "ALIPAY"))
                .thenReturn(new PaymentInitiateResult("ALI-QUOTE-1", "<form>PAY</form>"));
        OrderResponseDTO confirmedPay = orderService.customerConfirmQuoteAndPay(
                created.orderNumber(), "lin@example.com", "ALIPAY", rescheduled.quoteVersion());

        assertEquals(OrderStatus.PENDING_PAYMENT, confirmedPay.status());
        assertEquals(new BigDecimal("1180.00"), confirmedPay.totalAmount());
        assertEquals("<form>PAY</form>", confirmedPay.payData());
        assertNotNull(stored[0].getCustomerQuoteConfirmedAt());
    }

    @Test
    void failedQcBlocksShippingAndDelayPreservesInitialPromisedDate() {
        LocalDate initialDate = LocalDate.now().plusDays(14);
        Order paidOrder = Order.builder()
                .orderNumber("KL-QC-1")
                .status(OrderStatus.PAID)
                .fulfillmentStatus(FulfillmentStatus.IN_PRODUCTION)
                .initialPromisedDeliveryDate(initialDate)
                .estimatedDeliveryDate(initialDate)
                .totalAmount(new BigDecimal("950.00"))
                .build();

        when(orderRepository.findByOrderNumberWithWriteLock("KL-QC-1")).thenReturn(Optional.of(paidOrder));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        LocalDate delayedDate = initialDate.plusDays(5);
        orderService.adminUpdateFulfillment(
                "KL-QC-1", FulfillmentStatus.IN_PRODUCTION, "镜片镀膜复检重做",
                delayedDate, "质检发现边缘微划痕，安排加急重做", true, "FAILED", "右眼镀膜划痕", "qc@klarheit.com"
        );

        assertEquals(initialDate, paidOrder.getInitialPromisedDeliveryDate());
        assertEquals(delayedDate, paidOrder.getEstimatedDeliveryDate());
        assertEquals("FAILED", paidOrder.getQcStatus());
        assertNotNull(paidOrder.getOpticianVerifiedAt());

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> orderService.adminShipOrder("KL-QC-1", "顺丰速运", "SF999"));
        assertTrue(ex.getMessage().contains("质检未通过"));
    }

    @Test
    void afterSalesExecutionSupportsQcRestockPostShipRefundAndFinanceClosureGate() {
        Order deliveredOrder = Order.builder()
                .orderNumber("KL-DEL-1")
                .status(OrderStatus.DELIVERED)
                .totalAmount(new BigDecimal("950.00"))
                .paymentChannel("ALIPAY")
                .gatewayTransactionId("ALI-TX-99")
                .product(aeroProduct)
                .skuId(102L)
                .build();

        AfterSalesTicket ticket = new AfterSalesTicket();
        ticket.setTicketNumber("AS-20261122-1001");
        ticket.setOrderNumber("KL-DEL-1");
        ticket.setUserId(7L);
        ticket.setCategory("DAMAGED");
        ticket.setReason("镜腿运输划伤");
        ticket.setStatus("OPEN");

        when(afterSalesTicketRepository.findByTicketNumber("AS-20261122-1001")).thenReturn(Optional.of(ticket));
        when(afterSalesTicketRepository.save(any(AfterSalesTicket.class))).thenAnswer(inv -> inv.getArgument(0));
        when(orderRepository.findByOrderNumberWithWriteLock("KL-DEL-1")).thenReturn(Optional.of(deliveredOrder));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1. Cannot restock before return QC marks RESTOCKABLE
        assertThrows(IllegalStateException.class,
                () -> afterSalesService.restockReturnedItem("AS-20261122-1001", "warehouse@klarheit.com"));

        // 2. Record return logistics, QC RESTOCKABLE, remake tracking & root cause
        afterSalesService.updateTicketForAdmin("AS-20261122-1001", new AfterSalesTicketUpdateDTO(
                "IN_PROGRESS", "ops@klarheit.com", "已收退件待质检", null,
                "顺丰速运", "SF-RET-888", LocalDateTime.now(), "RESTOCKABLE", "镜架完好可二次消毒回库",
                "KL-REMAKE-1", "顺丰速运", "SF-NEW-999", "SHIPPING_DAMAGE"
        ), "ops@klarheit.com");

        // 3. Restock is executed once and idempotent on repeat
        AfterSalesTicketResponseDTO restocked = afterSalesService.restockReturnedItem("AS-20261122-1001", "warehouse@klarheit.com");
        assertTrue(restocked.returnRestocked());
        afterSalesService.restockReturnedItem("AS-20261122-1001", "warehouse@klarheit.com");
        verify(productSkuRepository, times(1)).incrementOnHandStock(102L);

        // 4. Execute post-shipment partial refund (¥200) -> order keeps DELIVERED with refund tracked
        when(paymentService.refundPayment(eq("KL-DEL-1"), eq("ALI-TX-99"), eq(new BigDecimal("200.00")), eq("ALIPAY"), anyString()))
                .thenReturn(true);
        AfterSalesTicketResponseDTO refunded = afterSalesService.executePostShipmentRefund(
                "AS-20261122-1001", new BigDecimal("200.00"), "运费及瑕疵补偿退款", null, "finance@klarheit.com");
        assertEquals(new BigDecimal("200.00"), refunded.refundAmount());
        assertEquals(new BigDecimal("200.00"), deliveredOrder.getRefundAmount());
        assertEquals(OrderStatus.DELIVERED, deliveredOrder.getStatus());

        // 5. Closing refunded ticket BEFORE finance sign-off is rejected
        assertThrows(IllegalStateException.class, () -> afterSalesService.updateTicketForAdmin(
                "AS-20261122-1001",
                new AfterSalesTicketUpdateDTO("CLOSED", null, null, null),
                "cs@klarheit.com"
        ));

        // 6. Finance verifies refund -> ticket can now be cleanly closed
        AfterSalesTicketResponseDTO verified = afterSalesService.financeVerifyTicketRefund(
                "AS-20261122-1001", "ALI-RF-20261122", "支付宝账单已核平", "finance@klarheit.com");
        assertEquals("finance@klarheit.com", verified.financeVerifiedBy());
        assertNotNull(verified.financeVerifiedAt());

        AfterSalesTicketResponseDTO closed = afterSalesService.updateTicketForAdmin(
                "AS-20261122-1001",
                new AfterSalesTicketUpdateDTO("CLOSED", null, "已向客户确认退款到账并结案", null),
                "cs@klarheit.com"
        );
        assertEquals("CLOSED", closed.status());
    }

    @Test
    void dashboardStatsAndReconciliationCsvTrackNetContributionAndInitialPromisedSla() {
        LocalDate pastPromised = LocalDate.now().minusDays(2);
        Order onTimeOrder = Order.builder()
                .orderNumber("KL-ON-1").status(OrderStatus.DELIVERED)
                .fulfillmentStatus(FulfillmentStatus.DELIVERED)
                .productNameSnapshot("AERO X1").finishId("titanium").sizeSpecSnapshot("54-17-140")
                .orderSource("XIAOHONGSHU").paymentChannel("ALIPAY").gatewayTransactionId("TX-ON-1")
                .totalAmount(new BigDecimal("1000.00")).discountAmount(BigDecimal.ZERO)
                .variableCostAmount(new BigDecimal("420.00"))
                .initialPromisedDeliveryDate(pastPromised).estimatedDeliveryDate(pastPromised)
                .createdAt(LocalDateTime.now().minusDays(15))
                .deliveredAt(pastPromised.minusDays(1).atTime(14, 0))
                .qcStatus("PASSED")
                .build();

        Order delayedOrder = Order.builder()
                .orderNumber("KL-DLY-2").status(OrderStatus.SHIPPED)
                .fulfillmentStatus(FulfillmentStatus.SHIPPED)
                .productNameSnapshot("AERO X1").finishId("rose-gold").sizeSpecSnapshot("54-17-140")
                .orderSource("DIRECT").paymentChannel("ALIPAY").gatewayTransactionId("TX-DLY-2")
                .totalAmount(new BigDecimal("900.00")).discountAmount(new BigDecimal("50.00"))
                .refundAmount(new BigDecimal("100.00")).variableCostAmount(new BigDecimal("400.00"))
                .initialPromisedDeliveryDate(pastPromised).estimatedDeliveryDate(LocalDate.now().plusDays(2))
                .createdAt(LocalDateTime.now().minusDays(16))
                .qcStatus("PASSED")
                .build();

        AfterSalesTicket tk = new AfterSalesTicket();
        tk.setTicketNumber("AS-1");
        tk.setOrderNumber("KL-DLY-2");
        tk.setRootCause("LAB_PROCESSING_ERROR");
        tk.setRemakeTrackingNumber("SF-RMK-1");

        when(orderRepository.count()).thenReturn(2L);
        when(userAccountRepository.count()).thenReturn(5L);
        when(orderRepository.findAll()).thenReturn(List.of(onTimeOrder, delayedOrder));
        when(afterSalesTicketRepository.findAll()).thenReturn(List.of(tk));

        ResponseEntity<Map<String, Object>> statsResp = adminController.getDashboardStats();
        Map<String, Object> stats = statsResp.getBody();
        assertNotNull(stats);
        assertEquals(new BigDecimal("1900.00"), stats.get("totalSales"));
        assertEquals(new BigDecimal("100.00"), stats.get("totalRefunded"));
        assertEquals(new BigDecimal("1800.00"), stats.get("netRevenue"));
        assertEquals(new BigDecimal("980.00"), stats.get("netContribution")); // 1800 - (420 + 400)

        @SuppressWarnings("unchecked")
        Map<String, Object> sla = (Map<String, Object>) stats.get("onTimeDeliveryMetrics");
        assertEquals(2L, sla.get("dueCount"));
        assertEquals(1L, sla.get("onTimeDeliveredCount"));
        assertEquals(1L, sla.get("delayedCount"));
        assertEquals(new BigDecimal("50.0"), sla.get("onTimeRatePct"));

        ResponseEntity<byte[]> csvResp = adminController.exportReconciliationCsv(null, null);
        String csvText = new String(csvResp.getBody(), StandardCharsets.UTF_8);
        assertTrue(csvText.startsWith("\uFEFForder_number,"));
        assertTrue(csvText.contains("KL-ON-1") && csvText.contains("ON_TIME"));
        assertTrue(csvText.contains("KL-DLY-2") && csvText.contains("OVERDUE") && csvText.contains("SF-RMK-1"));
    }

    @Test
    void completePaymentCommitsSkuStockViaDirectSqlWithoutTouchingLazyProductProxy() {
        Product lazyProductProxy = mock(Product.class);
        when(lazyProductProxy.getId()).thenReturn(5L);
        lenient().doThrow(new org.hibernate.LazyInitializationException("Proxy must not be mutated"))
                .when(lazyProductProxy).setStockQuantity(anyInt());

        Order pendingOrder = Order.builder()
                .orderNumber("KL-PAY-SKU-1")
                .status(OrderStatus.PENDING_PAYMENT)
                .fulfillmentStatus(FulfillmentStatus.PENDING_REVIEW)
                .opticianVerifiedBy("optician@klarheit.com")
                .opticianVerifiedAt(LocalDateTime.now().minusMinutes(5))
                .totalAmount(new BigDecimal("1180.00"))
                .customerEmail("lin@example.com")
                .product(lazyProductProxy)
                .productNameSnapshot("AERO X1")
                .skuId(105L)
                .skuStockCommitted(false)
                .paymentChannel("ALIPAY")
                .build();

        when(orderRepository.findByOrderNumberWithWriteLock("KL-PAY-SKU-1")).thenReturn(Optional.of(pendingOrder));
        when(productSkuRepository.commitReservedStock(105L)).thenReturn(1);
        when(productSkuRepository.sumAvailableQtyByProductId(5L)).thenReturn(59);
        when(productRepository.updateStockQuantity(5L, 59)).thenReturn(1);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        orderService.completePayment("KL-PAY-SKU-1", "MOCK-TX-1", "ALIPAY", new BigDecimal("1180.00"));

        assertEquals(OrderStatus.PAID, pendingOrder.getStatus());
        assertEquals(FulfillmentStatus.IN_PRODUCTION, pendingOrder.getFulfillmentStatus());
        assertTrue(pendingOrder.isSkuStockCommitted());
        verify(productSkuRepository).commitReservedStock(105L);
        verify(productSkuRepository).sumAvailableQtyByProductId(5L);
        verify(productRepository).updateStockQuantity(5L, 59);
        verify(productRepository, never()).save(any(Product.class));
    }
}
