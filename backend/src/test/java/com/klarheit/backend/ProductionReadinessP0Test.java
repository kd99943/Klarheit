package com.klarheit.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.klarheit.backend.aftersales.AfterSalesService;
import com.klarheit.backend.aftersales.AfterSalesTicket;
import com.klarheit.backend.aftersales.AfterSalesTicketRepository;
import com.klarheit.backend.aftersales.dto.AfterSalesTicketRequestDTO;
import com.klarheit.backend.aftersales.dto.AfterSalesTicketResponseDTO;
import com.klarheit.backend.aftersales.dto.AfterSalesTicketUpdateDTO;
import com.klarheit.backend.audit.AuditLogService;
import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.auth.UserService;
import com.klarheit.backend.config.ApiExceptionHandler;
import com.klarheit.backend.coupon.CouponService;
import com.klarheit.backend.email.EmailService;
import com.klarheit.backend.lens.LensOption;
import com.klarheit.backend.lens.LensOptionRepository;
import com.klarheit.backend.order.AdminController;
import com.klarheit.backend.order.BusinessClock;
import com.klarheit.backend.order.DeliveryPolicyService;
import com.klarheit.backend.order.FulfillmentStatus;
import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderQuoteVersion;
import com.klarheit.backend.order.OrderQuoteVersionRepository;
import com.klarheit.backend.order.OrderRepository;
import com.klarheit.backend.order.OrderService;
import com.klarheit.backend.order.OrderShipmentEvent;
import com.klarheit.backend.order.OrderShipmentEventRepository;
import com.klarheit.backend.order.OrderStatus;
import com.klarheit.backend.order.QuoteVersionConflictException;
import com.klarheit.backend.order.dto.CustomerInfoDTO;
import com.klarheit.backend.order.dto.OrderDetailResponseDTO;
import com.klarheit.backend.order.dto.OrderRequestDTO;
import com.klarheit.backend.order.dto.OrderResponseDTO;
import com.klarheit.backend.order.dto.PrescriptionDetailsDTO;
import com.klarheit.backend.payment.PaymentInitiateResult;
import com.klarheit.backend.payment.PaymentReconciliationScheduler;
import com.klarheit.backend.payment.PaymentService;
import com.klarheit.backend.payment.RefundResult;
import com.klarheit.backend.payment.RefundStatus;
import com.klarheit.backend.payment.RefundTransaction;
import com.klarheit.backend.payment.RefundTransactionRepository;
import com.klarheit.backend.prescription.Prescription;
import com.klarheit.backend.prescription.PrescriptionRepository;
import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductRepository;
import com.klarheit.backend.product.ProductSalesStatus;
import com.klarheit.backend.product.ProductService;
import com.klarheit.backend.product.ProductSku;
import com.klarheit.backend.product.ProductSkuRepository;
import com.klarheit.backend.product.dto.ProductResponseDTO;
import com.klarheit.backend.product.dto.ProductSkuDTO;
import com.klarheit.backend.product.dto.StocktakeItemDTO;
import com.klarheit.backend.security.StaffRoles;
import com.klarheit.backend.settings.SystemSettingService;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * End-to-end verification suite covering all code-level P0 acceptance items in
 * docs/PRODUCTION_READINESS_AUDIT.md (P0-01 through P0-10 and Section 6 Kill Switch).
 */
@ExtendWith(MockitoExtension.class)
class ProductionReadinessP0Test {

    @Mock private ProductRepository productRepository;
    @Mock private ProductSkuRepository productSkuRepository;
    @Mock private LensOptionRepository lensOptionRepository;
    @Mock private PrescriptionRepository prescriptionRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private OrderQuoteVersionRepository orderQuoteVersionRepository;
    @Mock private OrderShipmentEventRepository orderShipmentEventRepository;
    @Mock private RefundTransactionRepository refundTransactionRepository;
    @Mock private UserService userService;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private EmailService emailService;
    @Mock private CouponService couponService;
    @Mock private PaymentService paymentService;
    @Mock private AfterSalesTicketRepository afterSalesTicketRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private SystemSettingService systemSettingService;

    private DeliveryPolicyService deliveryPolicyService;
    private OrderService orderService;
    private ProductService productService;
    private AfterSalesService afterSalesService;
    private AdminController adminController;
    private PaymentReconciliationScheduler scheduler;

    private Product aeroProduct;
    private UserAccount customer;
    private UserAccount adminUser;
    private LensOption lens156;
    private LensOption lens167;
    private LensOption lens174;
    private PrescriptionDetailsDTO normalRx;
    private CustomerInfoDTO shanghaiCustomer;

    @BeforeEach
    void setUp() {
        deliveryPolicyService = new DeliveryPolicyService();

        orderService = new OrderService(
                productRepository, lensOptionRepository, prescriptionRepository,
                orderRepository, userService, emailService, couponService, paymentService
        );
        orderService.setProductSkuRepository(productSkuRepository);
        orderService.setOrderQuoteVersionRepository(orderQuoteVersionRepository);
        orderService.setOrderShipmentEventRepository(orderShipmentEventRepository);
        orderService.setRefundTransactionRepository(refundTransactionRepository);
        orderService.setDeliveryPolicyService(deliveryPolicyService);
        orderService.setSystemSettingService(systemSettingService);

        productService = new ProductService(productRepository);
        productService.setProductSkuRepository(productSkuRepository);

        afterSalesService = new AfterSalesService(
                afterSalesTicketRepository, orderRepository, userService, auditLogService
        );
        afterSalesService.setPaymentService(paymentService);
        afterSalesService.setProductSkuRepository(productSkuRepository);
        afterSalesService.setProductRepository(productRepository);
        afterSalesService.setRefundTransactionRepository(refundTransactionRepository);

        adminController = new AdminController(
                orderRepository, userAccountRepository, productService,
                auditLogService, orderService, couponService
        );
        ReflectionTestUtils.setField(adminController, "afterSalesTicketRepository", afterSalesTicketRepository);
        adminController.setRefundTransactionRepository(refundTransactionRepository);

        scheduler = new PaymentReconciliationScheduler(orderRepository, orderService);
        scheduler.setRefundTransactionRepository(refundTransactionRepository);
        scheduler.setAfterSalesService(afterSalesService);

        aeroProduct = Product.builder()
                .id(1L).name("AERO X1").nameEn("AERO X1").nameZh("AERO X1")
                .material("Titanium").materialEn("Titanium").materialZh("钛金属")
                .basePrice(new BigDecimal("850.00")).imageUrl("/images/aero.png")
                .shape("ROUND").specsSize("50-17-140").stockQuantity(10)
                .salesStatus(ProductSalesStatus.AVAILABLE)
                .build();

        customer = UserAccount.builder()
                .id(7L).firstName("Lin").lastName("Wei").email("lin@example.com")
                .phone("13800138000").role(StaffRoles.USER).build();

        adminUser = UserAccount.builder()
                .id(1L).firstName("Ops").lastName("Admin").email("admin@klarheit.com")
                .phone("13900001111").role(StaffRoles.ADMIN).build();

        lens156 = LensOption.builder().id(1L).type("STANDARD_156").category("LENS")
                .label("1.56 Standard").additionalPrice(BigDecimal.ZERO).build();
        lens167 = LensOption.builder().id(3L).type("ULTRATHIN_167").category("LENS")
                .label("1.67 Ultra-Thin").additionalPrice(new BigDecimal("160.00")).build();
        lens174 = LensOption.builder().id(4L).type("HIGH_INDEX_174").category("LENS")
                .label("1.74 High-Index").additionalPrice(new BigDecimal("215.00")).build();

        normalRx = new PrescriptionDetailsDTO(
                new BigDecimal("-2.00"), new BigDecimal("-2.00"),
                BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, new BigDecimal("63.0"));
        shanghaiCustomer = new CustomerInfoDTO(
                "Lin", "Wei", "lin@example.com", "上海市 上海市 静安区 南京西路88号",
                "13800138000", "上海市", "上海市", "静安区", "南京西路88号");

        lenient().when(systemSettingService.isCheckoutEnabled()).thenReturn(true);
    }

    // ── P0-01: Strict End-to-End SKU Consistency ──────────────────────

    @Test
    void p0_01_strictSkuMatchingRejectsSoldOutDiscontinuedOrMissingSizeWithoutSilentFallback() {
        ProductSku silverSmall = buildSku(101L, "silver", "48-17-140", 0, 0, 0, ProductSalesStatus.AVAILABLE);
        ProductSku silverLarge = buildSku(102L, "silver", "54-17-145", 5, 0, 0, ProductSalesStatus.AVAILABLE);
        ProductSku blackSmall = buildSku(103L, "matte-black", "48-17-140", 1, 0, 0, ProductSalesStatus.AVAILABLE);
        List<ProductSku> allSkus = List.of(silverSmall, silverLarge, blackSmall);

        when(productRepository.findById(1L)).thenReturn(Optional.of(aeroProduct));
        when(userService.findByEmailIgnoreCase("lin@example.com")).thenReturn(Optional.of(customer));
        lenient().when(productSkuRepository.findByProductIdOrderByIdAsc(1L)).thenReturn(allSkus);

        // Case 1: Silver-Small sold out -> MUST reject (must NOT fall back to Silver-Large or Black-Small!)
        when(productSkuRepository.findById(101L)).thenReturn(Optional.of(silverSmall));
        OrderRequestDTO soldOutReq = new OrderRequestDTO(
                1L, List.of("STANDARD_156"), shanghaiCustomer, normalRx, null, "ALIPAY",
                "silver", null, null, false, "48-17-140", "DIRECT", 101L);
        assertThrows(IllegalStateException.class, () -> orderService.checkout(soldOutReq, "lin@example.com"));

        // Case 2: Non-existent / delisted finish -> MUST reject (no fallback to first SKU!)
        when(productSkuRepository.findByProductIdAndFinishIdAndSizeSpec(1L, "rose-gold", "48-17-140"))
                .thenReturn(Optional.empty());
        OrderRequestDTO delistedReq = new OrderRequestDTO(
                1L, List.of("STANDARD_156"), shanghaiCustomer, normalRx, null, "ALIPAY",
                "rose-gold", null, null, false, "48-17-140", "DIRECT", null);
        IllegalStateException delistedEx = assertThrows(IllegalStateException.class,
                () -> orderService.checkout(delistedReq, "lin@example.com"));
        assertTrue(delistedEx.getMessage().contains("不存在") || delistedEx.getMessage().contains("下架"));

        // Case 3: Existing finish (silver) but non-existent size (52-18-145) -> MUST reject (no fallback to Silver-Large!)
        when(productSkuRepository.findByProductIdAndFinishIdAndSizeSpec(1L, "silver", "52-18-145"))
                .thenReturn(Optional.empty());
        OrderRequestDTO missingSizeReq = new OrderRequestDTO(
                1L, List.of("STANDARD_156"), shanghaiCustomer, normalRx, null, "ALIPAY",
                "silver", null, null, false, "52-18-145", "DIRECT", null);
        IllegalStateException sizeEx = assertThrows(IllegalStateException.class,
                () -> orderService.checkout(missingSizeReq, "lin@example.com"));
        assertTrue(sizeEx.getMessage().contains("尺码"));

        // Case 4: Exact Black-Small (last pair) succeeds once and writes canonical SKU snapshot, second buyer rejected
        when(productSkuRepository.findById(103L)).thenReturn(Optional.of(blackSmall));
        when(productSkuRepository.reserveStockIfAvailable(103L)).thenReturn(1, 0);
        when(lensOptionRepository.findByTypeIn(List.of("STANDARD_156"))).thenReturn(List.of(lens156));
        when(prescriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentService.initiatePayment(anyString(), any(), eq("ALIPAY")))
                .thenReturn(new PaymentInitiateResult("TX-1", "<form></form>"));

        OrderRequestDTO blackSmallReq = new OrderRequestDTO(
                1L, List.of("STANDARD_156"), shanghaiCustomer, normalRx, null, "ALIPAY",
                "matte-black", null, null, false, "48-17-140", "DIRECT", 103L);
        OrderResponseDTO ok = orderService.checkout(blackSmallReq, "lin@example.com");
        assertEquals(103L, ok.skuId());
        assertEquals("matte-black", ok.finishId());
        assertEquals("48-17-140", ok.sizeSpecSnapshot());

        assertThrows(IllegalStateException.class, () -> orderService.checkout(blackSmallReq, "lin@example.com"));
    }

    // ── P0-02: Physical Stocktake Import & Pending Hold Expiry ────────

    @Test
    void p0_02_physicalStocktakeImportAndExpiredPrepayHoldsReleaseStockAndCouponOnce() {
        ProductSku existing = buildSku(201L, "silver", "48-17-140", 0, 1, 0, ProductSalesStatus.PAUSED);
        when(productRepository.findById(1L)).thenReturn(Optional.of(aeroProduct));
        when(productSkuRepository.findByProductIdAndFinishIdAndSizeSpec(1L, "silver", "48-17-140"))
                .thenReturn(Optional.of(existing));

        // Reject onHand < reserved + committed (1 reserved + 2 committed = 3 > 2 onHand)
        assertThrows(IllegalArgumentException.class, () -> productService.importPhysicalStocktake(
                List.of(new StocktakeItemDTO(1L, "silver", "48-17-140", 2, 2, "Danyang Lab", "AVAILABLE", null, new BigDecimal("220"))),
                "warehouse@klarheit.com"));

        // Valid stocktake import: onHand=6, committed=1, reserved=1 -> available=4, stocktakeVerified=true
        when(productSkuRepository.save(any(ProductSku.class))).thenAnswer(inv -> inv.getArgument(0));
        when(productSkuRepository.findByProductIdOrderByIdAsc(1L)).thenReturn(List.of(existing));
        List<ProductSkuDTO> imported = productService.importPhysicalStocktake(
                List.of(new StocktakeItemDTO(1L, "silver", "48-17-140", 6, 1, "Danyang Lab", "AVAILABLE", null, new BigDecimal("220"))),
                "warehouse@klarheit.com");
        assertEquals(1, imported.size());
        assertEquals(4, imported.get(0).availableQty());
        assertEquals(Boolean.TRUE, imported.get(0).stocktakeVerified());
        assertEquals(4, aeroProduct.getStockQuantity());

        // Expired AWAITING_REVIEW & QUOTE_READY orders are cancelled by scheduler and release SKU + coupon ONCE
        Order expiredReview = Order.builder()
                .orderNumber("KL-EXP-REV").status(OrderStatus.AWAITING_REVIEW)
                .product(aeroProduct).skuId(201L).skuStockCommitted(false)
                .appliedCouponCode("VIP50").couponReleased(false).stockReleased(false)
                .createdAt(BusinessClock.now().minusHours(50))
                .reviewExpiresAt(BusinessClock.now().minusHours(2))
                .build();
        Order expiredQuote = Order.builder()
                .orderNumber("KL-EXP-QUO").status(OrderStatus.QUOTE_READY)
                .product(aeroProduct).skuId(201L).skuStockCommitted(false)
                .appliedCouponCode("VIP50").couponReleased(false).stockReleased(false)
                .createdAt(BusinessClock.now().minusHours(80))
                .quoteExpiresAt(BusinessClock.now().minusHours(1))
                .build();

        when(orderRepository.findExpiredOrders(any())).thenReturn(List.of());
        when(orderRepository.findExpiredAwaitingReviewOrders(any(), any())).thenReturn(List.of(expiredReview));
        when(orderRepository.findExpiredQuoteReadyOrders(any(), any())).thenReturn(List.of(expiredQuote));
        when(orderRepository.findCancelRequestedOrders()).thenReturn(List.of());
        when(orderRepository.findByStatus(OrderStatus.REFUND_PENDING)).thenReturn(List.of());
        when(refundTransactionRepository.findByStatusIn(any())).thenReturn(List.of());
        when(orderRepository.findByOrderNumberWithWriteLock("KL-EXP-REV")).thenReturn(Optional.of(expiredReview));
        when(orderRepository.findByOrderNumberWithWriteLock("KL-EXP-QUO")).thenReturn(Optional.of(expiredQuote));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        scheduler.cleanExpiredOrders();
        // Repeat expiration check must be pure idempotent no-op
        orderService.cancelExpiredOrder("KL-EXP-REV");

        assertEquals(OrderStatus.CANCELLED, expiredReview.getStatus());
        assertEquals(OrderStatus.CANCELLED, expiredQuote.getStatus());
        verify(productSkuRepository, times(2)).releaseReservedStock(201L);
        verify(couponService, times(2)).decrementCouponUsage("VIP50");
    }

    // ── P0-03: Quote Version Binding & Structured Reconfiguration ─────

    @Test
    void p0_03_quoteVersionConflictBlocksStalePageAndStructuredReconfigSwapsSkuAndLenses() {
        ProductSku oldSku = buildSku(301L, "silver", "48-17-140", 5, 1, 0, ProductSalesStatus.AVAILABLE);
        ProductSku newSku = buildSku(302L, "matte-black", "54-17-145", 5, 0, 0, ProductSalesStatus.AVAILABLE);

        Order reviewOrder = Order.builder()
                .orderNumber("KL-QUO-1").status(OrderStatus.AWAITING_REVIEW)
                .userId(7L).customerEmail("lin@example.com")
                .product(aeroProduct).skuId(301L).finishId("silver").sizeSpecSnapshot("48-17-140")
                .totalAmount(new BigDecimal("850.00")).discountAmount(BigDecimal.ZERO)
                .lensOptions(new ArrayList<>(List.of(lens156)))
                .lensOptionsSnapshot(List.of(new com.klarheit.backend.order.OrderLensSnapshot("STANDARD_156", "1.56 Standard", BigDecimal.ZERO)))
                .quoteVersion(0).prescriptionVersion(1)
                .build();

        when(orderRepository.findByOrderNumberWithWriteLock("KL-QUO-1")).thenReturn(Optional.of(reviewOrder));
        when(orderRepository.findByOrderNumber("KL-QUO-1")).thenReturn(Optional.of(reviewOrder));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(orderQuoteVersionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userService.findByEmailIgnoreCase("lin@example.com")).thenReturn(Optional.of(customer));

        // Publish v1
        OrderDetailResponseDTO v1 = orderService.adminConfirmPrepayQuote(
                "KL-QUO-1", new BigDecimal("950.00"), BusinessClock.today().plusDays(12), "v1 报价", "optician@klarheit.com");
        assertEquals(1, v1.quoteVersion());

        // Publish v2: change SKU 301 -> 302 AND upgrade lens STANDARD_156 -> ULTRATHIN_167 + new price
        when(productSkuRepository.findById(302L)).thenReturn(Optional.of(newSku));
        when(productSkuRepository.reserveStockIfAvailable(302L)).thenReturn(1);
        when(lensOptionRepository.findByTypeIn(List.of("ULTRATHIN_167"))).thenReturn(List.of(lens167));

        OrderDetailResponseDTO v2 = orderService.adminConfirmPrepayQuote(
                "KL-QUO-1", new BigDecimal("1010.00"), BusinessClock.today().plusDays(15),
                "换高折射率 1.67 镜片并更换哑光黑大号镜框", "optician@klarheit.com",
                302L, "matte-black", "54-17-145", List.of("ULTRATHIN_167"), null, null);

        assertEquals(2, v2.quoteVersion());
        assertEquals(302L, reviewOrder.getSkuId());
        assertEquals("matte-black", reviewOrder.getFinishId());
        assertEquals("54-17-145", reviewOrder.getSizeSpecSnapshot());
        assertEquals(List.of("ULTRATHIN_167"), reviewOrder.getLensOptionTypes());
        assertNotNull(v2.quoteChangeSummary());
        verify(productSkuRepository).reserveStockIfAvailable(302L);
        verify(productSkuRepository).releaseReservedStock(301L);

        // Old tab confirming v1 -> HTTP 409 QuoteVersionConflictException!
        QuoteVersionConflictException conflict = assertThrows(QuoteVersionConflictException.class,
                () -> orderService.customerConfirmQuoteAndPay("KL-QUO-1", "lin@example.com", "ALIPAY", 1));
        assertEquals(2, conflict.getCurrentQuoteVersion());
        var errorResp = new ApiExceptionHandler().handleQuoteVersionConflict(conflict);
        assertEquals(409, errorResp.getStatusCode().value());

        // New tab confirming v2 -> succeeds & opens payment
        when(paymentService.initiatePayment("KL-QUO-1", new BigDecimal("1010.00"), "ALIPAY"))
                .thenReturn(new PaymentInitiateResult("TX-Q2", "<form>v2</form>"));
        OrderResponseDTO pay1 = orderService.customerConfirmQuoteAndPay("KL-QUO-1", "lin@example.com", "ALIPAY", 2);
        assertEquals(OrderStatus.PENDING_PAYMENT, pay1.status());
        assertEquals(new BigDecimal("1010.00"), pay1.totalAmount());

        // Repeat click on same valid v2 -> idempotent, returns same order without error
        OrderResponseDTO payRepeat = orderService.customerConfirmQuoteAndPay("KL-QUO-1", "lin@example.com", "ALIPAY", 2);
        assertEquals("KL-QUO-1", payRepeat.orderNumber());
        assertEquals(new BigDecimal("1010.00"), payRepeat.totalAmount());
    }

    // ── P0-04: Five-Order Shipment Gate, Rx Version & Dedup Tracking ──

    @Test
    void p0_04_onlyOpticianVerifiedAndQcPassedOrderCanShipAndTrackingIsDeduplicated() {
        // 1. Pending review (not verified, not QC'd) -> BLOCKED
        Order o1Pending = paidOrder("KL-G1", FulfillmentStatus.PENDING_REVIEW, null, "PENDING", null);
        // 2. In production (verified, but not QC'd) -> BLOCKED
        Order o2InProd = paidOrder("KL-G2", FulfillmentStatus.IN_PRODUCTION, BusinessClock.now(), "PENDING", null);
        // 3. Marked QC_PASSED status without real QC timestamp/result -> BLOCKED
        Order o3NoQc = paidOrder("KL-G3", FulfillmentStatus.QC_PASSED, BusinessClock.now(), "PENDING", null);
        // 4. QC FAILED -> BLOCKED
        Order o4Failed = paidOrder("KL-G4", FulfillmentStatus.IN_PRODUCTION, BusinessClock.now(), "FAILED", BusinessClock.now());
        // 5. Verified + QC PASSED -> ALLOWED
        Order o5Passed = paidOrder("KL-G5", FulfillmentStatus.QC_PASSED, BusinessClock.now(), "PASSED", BusinessClock.now());

        for (Order o : List.of(o1Pending, o2InProd, o3NoQc, o4Failed, o5Passed)) {
            when(orderRepository.findByOrderNumberWithWriteLock(o.getOrderNumber())).thenReturn(Optional.of(o));
        }
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(orderShipmentEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThrows(IllegalStateException.class, () -> orderService.adminShipOrder("KL-G1", "SF", "SF1", "wh@klarheit.com"));
        assertThrows(IllegalStateException.class, () -> orderService.adminShipOrder("KL-G2", "SF", "SF2", "wh@klarheit.com"));
        assertThrows(IllegalStateException.class, () -> orderService.adminShipOrder("KL-G3", "SF", "SF3", "wh@klarheit.com"));
        assertThrows(IllegalStateException.class, () -> orderService.adminShipOrder("KL-G4", "SF", "SF4", "wh@klarheit.com"));

        // 5th order ships cleanly -> sends 1 email + records INITIAL_SHIP
        orderService.adminShipOrder("KL-G5", "SF", "SF555", "wh@klarheit.com");
        assertEquals(OrderStatus.SHIPPED, o5Passed.getStatus());
        LocalDateTime firstShippedAt = o5Passed.getFirstShippedAt();
        assertNotNull(firstShippedAt);

        // Duplicate entry of identical tracking -> NO duplicate email!
        orderService.adminShipOrder("KL-G5", "SF", "SF555", "wh@klarheit.com");
        verify(emailService, times(1)).sendShippingNotification("lin@example.com", "KL-G5", "AERO X1", "SF", "SF555");

        // Tracking update records separate TRACKING_UPDATE event and preserves original firstShippedAt
        orderService.adminUpdateTracking("KL-G5", "SF", "SF666", "换单重发", "wh@klarheit.com");
        assertEquals(firstShippedAt, o5Passed.getFirstShippedAt());
        assertEquals("SF666", o5Passed.getTrackingNumber());
        ArgumentCaptor<OrderShipmentEvent> eventCaptor = ArgumentCaptor.forClass(OrderShipmentEvent.class);
        verify(orderShipmentEventRepository, times(2)).save(eventCaptor.capture());
        assertEquals(OrderShipmentEvent.TYPE_INITIAL_SHIP, eventCaptor.getAllValues().get(0).getEventType());
        assertEquals(OrderShipmentEvent.TYPE_TRACKING_UPDATE, eventCaptor.getAllValues().get(1).getEventType());

        // Prescription revision bumps version and invalidates prior optician verification & QC
        when(prescriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(orderRepository.findByOrderNumber("KL-G2")).thenReturn(Optional.of(o2InProd));
        orderService.adminReviseOrderPrescription("KL-G2", normalRx, "客户改散光轴位", "optician@klarheit.com");
        assertEquals(2, o2InProd.getPrescriptionVersion());
        assertNull(o2InProd.getOpticianVerifiedAt());
        assertEquals(FulfillmentStatus.PENDING_REVIEW, o2InProd.getFulfillmentStatus());
    }

    // ── P0-05: Pre-Payment Delivery Region, Incomplete & Manual Review ─

    @Test
    void p0_05_deliveryPolicyRejectsOutOfRegionRoutesUnparseableToManualReviewAndCalculatesRemoteFee() {
        // 1. Out-of-region (Hong Kong / USA) rejected
        CustomerInfoDTO hkAddr = new CustomerInfoDTO("Lin", "Wei", "lin@example.com", "香港特别行政区中环1号",
                "13800138000", "香港", "香港", "中环", "皇后大道1号");
        DeliveryPolicyService.DeliveryEstimate hkEst = deliveryPolicyService.evaluate(hkAddr, "13800138000");
        assertFalse(hkEst.deliverable());

        // 2. Incomplete structured address rejected
        CustomerInfoDTO incompleteAddr = new CustomerInfoDTO("Lin", "Wei", "lin@example.com", "上海市",
                "13800138000", "上海市", "", "", "1号");
        assertThrows(IllegalArgumentException.class, () -> deliveryPolicyService.evaluate(incompleteAddr, "13800138000"));

        // 3. Remote Mainland province (Xinjiang) -> ¥25 fee, 14-18 days
        CustomerInfoDTO xjAddr = new CustomerInfoDTO("Lin", "Wei", "lin@example.com", "新疆乌鲁木齐市天山区人民路88号",
                "13800138000", "新疆", "乌鲁木齐市", "天山区", "人民路88号");
        DeliveryPolicyService.DeliveryEstimate xjEst = deliveryPolicyService.evaluate(xjAddr, "13800138000");
        assertTrue(xjEst.deliverable());
        assertFalse(xjEst.manualReviewRequired());
        assertEquals(new BigDecimal("25.00"), xjEst.shippingFee());
        assertEquals(18, xjEst.maxDays());

        // 4. Unparseable free-text address -> routes to AWAITING_REVIEW (manual confirmation before payment)
        CustomerInfoDTO ambiguousAddr = new CustomerInfoDTO("Lin", "Wei", "lin@example.com", "科技园A座302室", "13800138000");
        when(productRepository.findById(1L)).thenReturn(Optional.of(aeroProduct));
        when(productSkuRepository.findByProductIdOrderByIdAsc(1L)).thenReturn(List.of());
        when(productRepository.decrementStockIfAvailable(1L)).thenReturn(1);
        when(userService.findByEmailIgnoreCase("lin@example.com")).thenReturn(Optional.of(customer));
        when(lensOptionRepository.findByTypeIn(List.of("STANDARD_156"))).thenReturn(List.of(lens156));
        when(prescriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        Order[] saved = new Order[1];
        when(orderRepository.save(any())).thenAnswer(inv -> {
            saved[0] = inv.getArgument(0);
            return saved[0];
        });

        OrderRequestDTO ambigReq = new OrderRequestDTO(
                1L, List.of("STANDARD_156"), ambiguousAddr, normalRx, null, "ALIPAY", "titanium");
        OrderResponseDTO resp = orderService.checkout(ambigReq, "lin@example.com");
        assertEquals(OrderStatus.AWAITING_REVIEW, resp.status());
        assertTrue(saved[0].isDeliveryReviewRequired());
        assertNull(saved[0].getInitialPromisedDeliveryDate());
    }

    // ── P0-06: Separate Requested vs Confirmed Refund Ledger ──────────

    @Test
    void p0_06_itemizedPartialRefundsUseDistinctIdsFailedRefundNotCountedAsConfirmedAndRetryReusesId() {
        Order delivered = Order.builder()
                .orderNumber("KL-RF-1").status(OrderStatus.DELIVERED)
                .totalAmount(new BigDecimal("1000.00"))
                .paymentChannel("ALIPAY").gatewayTransactionId("ALI-TX-1000")
                .confirmedRefundAmount(BigDecimal.ZERO).pendingRefundAmount(BigDecimal.ZERO)
                .build();

        AfterSalesTicket ticket = new AfterSalesTicket();
        ticket.setTicketNumber("AS-RF-1");
        ticket.setOrderNumber("KL-RF-1");
        ticket.setUserId(7L);
        ticket.setStatus("OPEN");

        List<RefundTransaction> ledger = new ArrayList<>();
        when(afterSalesTicketRepository.findByTicketNumber("AS-RF-1")).thenReturn(Optional.of(ticket));
        when(afterSalesTicketRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(orderRepository.findByOrderNumberWithWriteLock("KL-RF-1")).thenReturn(Optional.of(delivered));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(refundTransactionRepository.save(any(RefundTransaction.class))).thenAnswer(inv -> {
            RefundTransaction tx = inv.getArgument(0);
            if (!ledger.contains(tx)) ledger.add(tx);
            return tx;
        });
        when(refundTransactionRepository.findByOrderNumberOrderByRequestedAtAsc("KL-RF-1"))
                .thenAnswer(inv -> new ArrayList<>(ledger));
        when(refundTransactionRepository.findByTicketNumberOrderByRequestedAtAsc("AS-RF-1"))
                .thenAnswer(inv -> new ArrayList<>(ledger));
        when(refundTransactionRepository.findByRefundRequestId(anyString()))
                .thenAnswer(inv -> ledger.stream().filter(t -> t.getRefundRequestId().equals(inv.getArgument(0))).findFirst());

        // Partial refund #1 (¥200) FAILS at gateway -> must NOT increment confirmedRefundAmount or mark REFUNDED
        when(paymentService.refundPaymentWithRequestId(eq("KL-RF-1"), eq("ALI-TX-1000"),
                eq(new BigDecimal("200.00")), eq("ALIPAY"), anyString(), anyString()))
                .thenReturn(RefundResult.failed("Alipay timeout"));

        AfterSalesTicketResponseDTO afterFail = afterSalesService.executePostShipmentRefund(
                "AS-RF-1", new BigDecimal("200.00"), "部分补偿1", null, "finance@klarheit.com");

        assertEquals(BigDecimal.ZERO, delivered.getConfirmedRefundAmount());
        assertEquals(new BigDecimal("200.00"), delivered.getPendingRefundAmount());
        assertNull(delivered.getRefundAmount());
        assertEquals(OrderStatus.DELIVERED, delivered.getStatus());
        assertEquals(1, ledger.size());
        String firstReqId = ledger.get(0).getRefundRequestId();
        assertEquals(RefundStatus.FAILED, ledger.get(0).getStatus());
        assertEquals(BigDecimal.ZERO, afterFail.confirmedRefundAmount());
        assertEquals(new BigDecimal("200.00"), afterFail.pendingRefundAmount());

        // Partial refund #2 (¥300) SUCCEEDS with a DIFFERENT refundRequestId!
        when(paymentService.refundPaymentWithRequestId(eq("KL-RF-1"), eq("ALI-TX-1000"),
                eq(new BigDecimal("300.00")), eq("ALIPAY"), anyString(), anyString()))
                .thenReturn(RefundResult.confirmed("ALI-RF-300", new BigDecimal("300.00")));

        afterSalesService.executePostShipmentRefund(
                "AS-RF-1", new BigDecimal("300.00"), "部分补偿2", null, "finance@klarheit.com");

        assertEquals(2, ledger.size());
        String secondReqId = ledger.get(1).getRefundRequestId();
        assertNotEquals(firstReqId, secondReqId);
        assertEquals(new BigDecimal("300.00"), delivered.getConfirmedRefundAmount());
        assertEquals(new BigDecimal("200.00"), delivered.getPendingRefundAmount());

        // Finance verify MUST reject blank txId OR unresolved failed refund remaining!
        assertThrows(IllegalArgumentException.class,
                () -> afterSalesService.financeVerifyTicketRefund("AS-RF-1", "", "note", "finance@klarheit.com"));
        assertThrows(IllegalStateException.class,
                () -> afterSalesService.financeVerifyTicketRefund("AS-RF-1", "ALI-RF-300", "note", "finance@klarheit.com"));

        // Retry partial refund #1 -> reuses EXACT SAME firstReqId and succeeds!
        when(paymentService.refundPaymentWithRequestId(eq("KL-RF-1"), eq("ALI-TX-1000"),
                eq(new BigDecimal("200.00")), eq("ALIPAY"), anyString(), eq(firstReqId)))
                .thenReturn(RefundResult.confirmed("ALI-RF-200", new BigDecimal("200.00")));

        var retried = afterSalesService.retryRefundTransaction(firstReqId, "finance@klarheit.com");
        assertEquals(RefundStatus.CONFIRMED, retried.status());
        assertEquals(new BigDecimal("500.00"), delivered.getConfirmedRefundAmount());
        assertEquals(BigDecimal.ZERO, delivered.getPendingRefundAmount());

        // Now finance verify with real voucher succeeds and ticket can close
        afterSalesService.financeVerifyTicketRefund("AS-RF-1", "ALI-RF-200", "两笔退款均已核平", "finance@klarheit.com");
        AfterSalesTicketResponseDTO closed = afterSalesService.updateTicketForAdmin(
                "AS-RF-1", new AfterSalesTicketUpdateDTO("CLOSED", null, "结案", null), "cs@klarheit.com");
        assertEquals("CLOSED", closed.status());
    }

    // ── P0-07: Order-Level Physical Return Restock Lock ──────────────

    @Test
    void p0_07_twoTicketsForSameOrderCannotDoubleRestockPhysicalItem() {
        Order delivered = Order.builder()
                .orderNumber("KL-RET-1").status(OrderStatus.DELIVERED)
                .product(aeroProduct).skuId(102L).returnRestocked(false).build();

        AfterSalesTicket t1 = new AfterSalesTicket();
        t1.setTicketNumber("AS-RET-1");
        t1.setOrderNumber("KL-RET-1");
        t1.setReturnReceivedAt(BusinessClock.now());
        t1.setReturnQcResult("RESTOCKABLE");

        AfterSalesTicket t2 = new AfterSalesTicket();
        t2.setTicketNumber("AS-RET-2");
        t2.setOrderNumber("KL-RET-1");
        t2.setReturnReceivedAt(BusinessClock.now());
        t2.setReturnQcResult("RESTOCKABLE");

        when(afterSalesTicketRepository.findByTicketNumber("AS-RET-1")).thenReturn(Optional.of(t1));
        when(afterSalesTicketRepository.findByTicketNumber("AS-RET-2")).thenReturn(Optional.of(t2));
        when(afterSalesTicketRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(orderRepository.findByOrderNumberWithWriteLock("KL-RET-1")).thenReturn(Optional.of(delivered));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Ticket 1 restocks +1; repeat call on Ticket 1 is idempotent
        afterSalesService.restockReturnedItem("AS-RET-1", "warehouse@klarheit.com");
        afterSalesService.restockReturnedItem("AS-RET-1", "warehouse@klarheit.com");

        // Ticket 2 referencing the SAME physical order MUST be blocked!
        IllegalStateException dupEx = assertThrows(IllegalStateException.class,
                () -> afterSalesService.restockReturnedItem("AS-RET-2", "warehouse@klarheit.com"));
        assertTrue(dupEx.getMessage().contains("AS-RET-1"));

        verify(productSkuRepository, times(1)).incrementOnHandStock(102L);
    }

    // ── P0-08: Period-Accurate Financial Reconciliation ──────────────

    @Test
    void p0_08_reconciliationMatchesFourAccountingCasesIncludingFullRefundAndCrossDayEvents() {
        LocalDate day1 = LocalDate.of(2026, 11, 20);
        LocalDate day2 = LocalDate.of(2026, 11, 21);

        // 1. Unpaid ¥100 -> 0 receipt, 0 refund, 0 net
        Order unpaid100 = Order.builder()
                .orderNumber("KL-A1").status(OrderStatus.PENDING_PAYMENT)
                .totalAmount(new BigDecimal("100.00"))
                .createdAt(day1.atTime(9, 0))
                .build();

        // 2. Paid ¥100 on Day 1 then full confirmed refund ¥100 on Day 1 -> 100 receipt, 100 refund, 0 net!
        Order fullRefund100 = Order.builder()
                .orderNumber("KL-A2").status(OrderStatus.REFUNDED)
                .totalAmount(new BigDecimal("100.00"))
                .confirmedRefundAmount(new BigDecimal("100.00"))
                .paidAt(day1.atTime(10, 0))
                .createdAt(day1.atTime(9, 55))
                .build();
        RefundTransaction txFull100 = new RefundTransaction();
        txFull100.setRefundRequestId("RF-A2-1");
        txFull100.setOrderNumber("KL-A2");
        txFull100.setRequestedAmount(new BigDecimal("100.00"));
        txFull100.setConfirmedAmount(new BigDecimal("100.00"));
        txFull100.setStatus(RefundStatus.CONFIRMED);
        txFull100.setRequestedAt(day1.atTime(14, 0));
        txFull100.setConfirmedAt(day1.atTime(14, 5));

        // 3. Cross-day: Paid ¥100 on Day 1, confirmed partial refund ¥30 on Day 2 (+ failed ¥20 pending!)
        Order crossDay = Order.builder()
                .orderNumber("KL-A3").status(OrderStatus.DELIVERED)
                .totalAmount(new BigDecimal("100.00"))
                .confirmedRefundAmount(new BigDecimal("30.00"))
                .pendingRefundAmount(new BigDecimal("20.00"))
                .variableCostAmount(new BigDecimal("40.00"))
                .shippingCostAmount(new BigDecimal("10.00"))
                .paymentFeeAmount(new BigDecimal("1.00"))
                .paidAt(day1.atTime(11, 0))
                .createdAt(day1.atTime(10, 50))
                .build();
        RefundTransaction txPartial30 = new RefundTransaction();
        txPartial30.setRefundRequestId("RF-A3-1");
        txPartial30.setOrderNumber("KL-A3");
        txPartial30.setRequestedAmount(new BigDecimal("30.00"));
        txPartial30.setConfirmedAmount(new BigDecimal("30.00"));
        txPartial30.setStatus(RefundStatus.CONFIRMED);
        txPartial30.setRequestedAt(day2.atTime(10, 0));
        txPartial30.setConfirmedAt(day2.atTime(10, 2));

        RefundTransaction txFailed20 = new RefundTransaction();
        txFailed20.setRefundRequestId("RF-A3-2");
        txFailed20.setOrderNumber("KL-A3");
        txFailed20.setRequestedAmount(new BigDecimal("20.00"));
        txFailed20.setStatus(RefundStatus.FAILED);
        txFailed20.setRequestedAt(day2.atTime(11, 0));

        when(orderRepository.count()).thenReturn(3L);
        when(userAccountRepository.count()).thenReturn(3L);
        List<Order> allTestOrders = List.of(unpaid100, fullRefund100, crossDay);
        List<RefundTransaction> allTestRefunds = List.of(txFull100, txPartial30, txFailed20);
        lenient().when(orderRepository.findAll()).thenReturn(allTestOrders);
        lenient().when(refundTransactionRepository.findAll()).thenReturn(allTestRefunds);
        lenient().when(afterSalesTicketRepository.findAll()).thenReturn(List.of());
        lenient().when(orderRepository.findPaidOrdersInPeriod(any(), any())).thenAnswer(inv -> {
            LocalDateTime fromInc = inv.getArgument(0);
            LocalDateTime toExc = inv.getArgument(1);
            return allTestOrders.stream()
                    .filter(o -> o.getPaidAt() != null
                            && (fromInc == null || !o.getPaidAt().isBefore(fromInc))
                            && (toExc == null || o.getPaidAt().isBefore(toExc)))
                    .toList();
        });
        lenient().when(orderRepository.findByOrderNumberIn(any())).thenAnswer(inv -> {
            java.util.Collection<String> nums = inv.getArgument(0);
            return allTestOrders.stream().filter(o -> nums.contains(o.getOrderNumber())).toList();
        });
        lenient().when(refundTransactionRepository.findConfirmedRefundsInPeriod(any(), any())).thenAnswer(inv -> {
            LocalDateTime fromInc = inv.getArgument(0);
            LocalDateTime toExc = inv.getArgument(1);
            return allTestRefunds.stream()
                    .filter(r -> RefundStatus.CONFIRMED.equalsIgnoreCase(r.getStatus()))
                    .filter(r -> {
                        LocalDateTime ts = r.getConfirmedAt() != null ? r.getConfirmedAt() : r.getRequestedAt();
                        return ts != null
                                && (fromInc == null || !ts.isBefore(fromInc))
                                && (toExc == null || ts.isBefore(toExc));
                    })
                    .toList();
        });
        lenient().when(refundTransactionRepository.findByStatusIn(any())).thenAnswer(inv -> {
            List<String> statuses = inv.getArgument(0);
            return allTestRefunds.stream().filter(r -> statuses.contains(r.getStatus())).toList();
        });
        lenient().when(afterSalesTicketRepository.findByOrderNumberIn(any())).thenReturn(List.of());

        // Day 1 period: paid = 100 (A2) + 100 (A3) = 200; confirmed refund = 100 (A2); net = 100!
        Map<String, Object> day1Stats = adminController.getDashboardStats("2026-11-20", "2026-11-20").getBody();
        assertNotNull(day1Stats);
        assertEquals(new BigDecimal("200.00"), day1Stats.get("grossReceipts"));
        assertEquals(new BigDecimal("100.00"), day1Stats.get("confirmedRefunded"));
        assertEquals(new BigDecimal("100.00"), day1Stats.get("netRevenue"));
        assertEquals(new BigDecimal("20.00"), day1Stats.get("pendingRefundAmount"));

        // Day 2 period: paid = 0; confirmed refund = 30 (A3); net = -30!
        Map<String, Object> day2Stats = adminController.getDashboardStats("2026-11-21", "2026-11-21").getBody();
        assertNotNull(day2Stats);
        assertEquals(BigDecimal.ZERO, day2Stats.get("grossReceipts"));
        assertEquals(new BigDecimal("30.00"), day2Stats.get("confirmedRefunded"));
        assertEquals(new BigDecimal("-30.00"), day2Stats.get("netRevenue"));

        // Combined Day 1..Day 2: paid = 200; confirmed refund = 130; net = 70; costs = 51; contribution = 19!
        Map<String, Object> fullStats = adminController.getDashboardStats("2026-11-20", "2026-11-21").getBody();
        assertNotNull(fullStats);
        assertEquals(new BigDecimal("200.00"), fullStats.get("grossReceipts"));
        assertEquals(new BigDecimal("130.00"), fullStats.get("confirmedRefunded"));
        assertEquals(new BigDecimal("70.00"), fullStats.get("netRevenue"));
        assertEquals(new BigDecimal("19.00"), fullStats.get("netContribution"));

        // CSV export for Day 2 includes KL-A3 because refund occurred on Day 2 (even though created/paid on Day 1!)
        String csvDay2 = new String(adminController.exportReconciliationCsv("2026-11-21", "2026-11-21").getBody(), StandardCharsets.UTF_8);
        assertTrue(csvDay2.contains("KL-A3"));
        assertFalse(csvDay2.contains("KL-A1"));
    }

    // ── P0-10: Public API & Customer Data Boundaries + Audit Masking ──

    @Test
    void p0_10_publicCatalogAndCustomerResponsesStripInternalFieldsAndMaskAuditAddress() throws Exception {
        ProductSku internalSku = buildSku(401L, "titanium", "50-17-140", 12, 2, 1, ProductSalesStatus.AVAILABLE);
        internalSku.setSupplierName("Secret Factory Co");
        internalSku.setUnitCost(new BigDecimal("185.00"));
        when(productRepository.findById(1L)).thenReturn(Optional.of(aeroProduct));
        when(productSkuRepository.findByProductIdOrderByIdAsc(1L)).thenReturn(List.of(internalSku));

        ProductResponseDTO publicProduct = productService.getProductById(1L);
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        JsonNode json = mapper.valueToTree(publicProduct);

        // Public JSON MUST NOT expose supplierName, unitCost, onHandQty, reservedQty, committedQty, availableQty, stockQuantity
        assertFalse(json.has("stockQuantity"));
        assertTrue(json.get("inStock").asBoolean());
        JsonNode skuJson = json.get("skus").get(0);
        assertFalse(skuJson.has("supplierName"));
        assertFalse(skuJson.has("unitCost"));
        assertFalse(skuJson.has("onHandQty"));
        assertFalse(skuJson.has("reservedQty"));
        assertFalse(skuJson.has("committedQty"));
        assertFalse(skuJson.has("availableQty"));
        assertTrue(skuJson.get("inStock").asBoolean());

        // Customer order view strips internal costs/operators/internal QC note; Admin view preserves them
        Order internalOrder = Order.builder()
                .orderNumber("KL-PRIV-1").userId(7L).customerEmail("lin@example.com")
                .status(OrderStatus.PAID).totalAmount(new BigDecimal("900.00"))
                .product(aeroProduct)
                .variableCostAmount(new BigDecimal("310.00"))
                .orderSource("XIAOHONGSHU")
                .opticianVerifiedBy("optician@klarheit.com").opticianVerifiedAt(BusinessClock.now())
                .qcStatus("PASSED").qcCheckedBy("qc@klarheit.com").qcCheckedAt(BusinessClock.now())
                .qcNote("Internal lens tolerance 0.02mm")
                .build();
        when(orderRepository.findByOrderNumber("KL-PRIV-1")).thenReturn(Optional.of(internalOrder));
        when(userService.findByEmailIgnoreCase("lin@example.com")).thenReturn(Optional.of(customer));
        when(userService.findByEmailIgnoreCase("admin@klarheit.com")).thenReturn(Optional.of(adminUser));

        OrderDetailResponseDTO customerView = orderService.getOrderDetails("KL-PRIV-1", "lin@example.com");
        assertNull(customerView.variableCostAmount());
        assertNull(customerView.orderSource());
        assertNull(customerView.opticianVerifiedBy());
        assertNull(customerView.qcCheckedBy());
        assertNull(customerView.qcNote());
        assertEquals("PASSED", customerView.qcStatus()); // Customer-safe status retained

        OrderDetailResponseDTO adminView = orderService.getOrderDetails("KL-PRIV-1", "admin@klarheit.com");
        assertEquals(new BigDecimal("310.00"), adminView.variableCostAmount());
        assertEquals("optician@klarheit.com", adminView.opticianVerifiedBy());
        assertEquals("qc@klarheit.com", adminView.qcCheckedBy());

        // Address audit masking + role revocation
        when(orderRepository.findByOrderNumberWithWriteLock("KL-PRIV-1")).thenReturn(Optional.of(internalOrder));
        internalOrder.setShippingAddress("上海市 静安区 南京西路88号1802室");
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("cs@klarheit.com");

        adminController.updateOrderAddress("KL-PRIV-1", Map.of(
                "shippingAddress", "北京市 朝阳区 建国门外大街99号国贸A座2501室",
                "province", "北京市", "city", "北京市", "district", "朝阳区",
                "detailAddress", "建国门外大街99号国贸A座2501室", "customerPhone", "13800138000"
        ), auth);

        ArgumentCaptor<String> detailsCaptor = ArgumentCaptor.forClass(String.class);
        verify(auditLogService).log(eq("cs@klarheit.com"), eq("UPDATE_ORDER_ADDRESS"), eq("ORDER"), eq("KL-PRIV-1"), detailsCaptor.capture());
        assertFalse(detailsCaptor.getValue().contains("1802室"));
        assertFalse(detailsCaptor.getValue().contains("2501室"));

        // Staff role revocation (e.g. departed warehouse staff -> USER)
        UserAccount staff = UserAccount.builder().id(99L).email("wh@klarheit.com").firstName("W").lastName("H").role(StaffRoles.WAREHOUSE).build();
        when(userAccountRepository.findById(99L)).thenReturn(Optional.of(staff));
        when(userAccountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        adminController.updateUserRole(99L, Map.of("role", "USER"), auth);
        assertEquals("USER", staff.getRole());
    }

    // ── Section 6 P0: Checkout Kill Switch Preserves Existing Orders ──

    @Test
    void section6_killSwitchBlocksNewCheckoutWhileAllowingExistingQuoteConfirmAndAfterSales() {
        when(systemSettingService.isCheckoutEnabled()).thenReturn(false);
        when(systemSettingService.getCheckoutPauseReason()).thenReturn("盘点停单演练");

        // 1. New checkout is blocked
        OrderRequestDTO newOrderReq = new OrderRequestDTO(
                1L, List.of("STANDARD_156"), shanghaiCustomer, normalRx, null, "ALIPAY", "silver");
        assertThrows(IllegalStateException.class, () -> orderService.checkout(newOrderReq, "lin@example.com"));

        // 2. Existing QUOTE_READY order confirmation STILL works during kill switch!
        Order existingQuote = Order.builder()
                .orderNumber("KL-EXIST-1").status(OrderStatus.QUOTE_READY)
                .userId(7L).customerEmail("lin@example.com")
                .totalAmount(new BigDecimal("950.00")).quoteRevisedAmount(new BigDecimal("950.00"))
                .quoteVersion(1).quoteExpiresAt(BusinessClock.now().plusHours(24))
                .product(aeroProduct).paymentChannel("ALIPAY")
                .build();
        when(userService.findByEmailIgnoreCase("lin@example.com")).thenReturn(Optional.of(customer));
        when(orderRepository.findByOrderNumberWithWriteLock("KL-EXIST-1")).thenReturn(Optional.of(existingQuote));
        when(orderRepository.findByOrderNumber("KL-EXIST-1")).thenReturn(Optional.of(existingQuote));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentService.initiatePayment("KL-EXIST-1", new BigDecimal("950.00"), "ALIPAY"))
                .thenReturn(new PaymentInitiateResult("TX-EX-1", "<form>ok</form>"));

        OrderResponseDTO confirmed = orderService.customerConfirmQuoteAndPay("KL-EXIST-1", "lin@example.com", "ALIPAY", 1);
        assertEquals(OrderStatus.PENDING_PAYMENT, confirmed.status());

        // 3. Existing order query & after-sales ticket creation STILL work during kill switch!
        assertNotNull(orderService.getOrderDetails("KL-EXIST-1", "lin@example.com"));
        when(afterSalesTicketRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        AfterSalesTicketResponseDTO ticket = afterSalesService.createTicket(
                "KL-EXIST-1", new AfterSalesTicketRequestDTO("OTHER", "咨询发货", "13800138000"), "lin@example.com");
        assertEquals("OPEN", ticket.status());
    }

    private ProductSku buildSku(Long id, String finishId, String sizeSpec, int onHand, int reserved, int committed, String status) {
        ProductSku sku = new ProductSku();
        sku.setId(id);
        sku.setProduct(aeroProduct);
        sku.setFinishId(finishId);
        sku.setSizeSpec(sizeSpec);
        sku.setOnHandQty(onHand);
        sku.setReservedQty(reserved);
        sku.setCommittedQty(committed);
        sku.setSalesStatus(status);
        sku.setStocktakeVerified(true);
        return sku;
    }

    private Order paidOrder(String orderNumber, String fulfillmentStatus, LocalDateTime verifiedAt, String qcStatus, LocalDateTime qcAt) {
        return Order.builder()
                .orderNumber(orderNumber).status(OrderStatus.PAID)
                .customerEmail("lin@example.com").productNameSnapshot("AERO X1")
                .fulfillmentStatus(fulfillmentStatus)
                .prescriptionVersion(1)
                .opticianVerifiedAt(verifiedAt)
                .opticianVerifiedRxVersion(verifiedAt != null ? 1 : null)
                .qcStatus(qcStatus).qcCheckedAt(qcAt)
                .totalAmount(new BigDecimal("900.00"))
                .build();
    }
}
