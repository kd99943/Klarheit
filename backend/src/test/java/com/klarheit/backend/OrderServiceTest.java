package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserService;
import com.klarheit.backend.email.EmailService;
import com.klarheit.backend.lens.LensOption;
import com.klarheit.backend.lens.LensOptionRepository;
import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderLensSnapshot;
import com.klarheit.backend.order.OrderRepository;
import com.klarheit.backend.order.OrderService;
import com.klarheit.backend.order.OrderStatus;
import com.klarheit.backend.order.dto.CustomerInfoDTO;
import com.klarheit.backend.order.dto.OrderRequestDTO;
import com.klarheit.backend.order.dto.OrderResponseDTO;
import com.klarheit.backend.order.dto.PrescriptionDetailsDTO;
import com.klarheit.backend.payment.PaymentQueryResult;
import com.klarheit.backend.prescription.Prescription;
import com.klarheit.backend.prescription.PrescriptionRepository;
import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private ProductRepository productRepository;
    @Mock
    private LensOptionRepository lensOptionRepository;
    @Mock
    private PrescriptionRepository prescriptionRepository;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private UserService userService;
    @Mock
    private EmailService emailService;
    @Mock
    private com.klarheit.backend.coupon.CouponService couponService;
    @Mock
    private com.klarheit.backend.payment.PaymentService paymentService;

    @InjectMocks
    private OrderService orderService;

    private Product product;
    private UserAccount user;
    private LensOption lensOption1;
    private LensOption lensOption2;
    private OrderRequestDTO validRequest;

    @BeforeEach
    void setUp() {
        product = Product.builder()
                .id(1L)
                .name("AERO X1")
                .material("Titanium")
                .basePrice(new BigDecimal("850.00"))
                .imageUrl("https://example.com/aero-x1.png")
                .build();

        user = UserAccount.builder()
                .id(1L)
                .email("test@example.com")
                .firstName("Test")
                .lastName("User")
                .passwordHash("hashed")
                .build();

        lensOption1 = LensOption.builder()
                .id(1L)
                .type("HIGH_INDEX_174")
                .additionalPrice(new BigDecimal("215.00"))
                .build();

        lensOption2 = LensOption.builder()
                .id(2L)
                .type("AR_ONYX")
                .additionalPrice(new BigDecimal("60.00"))
                .build();

        validRequest = new OrderRequestDTO(
                1L,
                List.of("HIGH_INDEX_174", "AR_ONYX"),
                new CustomerInfoDTO("John", "Doe", "test@example.com", "123 Main St"),
                new PrescriptionDetailsDTO(
                        new BigDecimal("-2.25"), new BigDecimal("-2.00"),
                        new BigDecimal("-0.50"), new BigDecimal("-0.25"),
                        180, 175,
                        new BigDecimal("63.50"))
        );
    }

    @Test
    void checkoutCalculatesTotalCorrectly() {
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.decrementStockIfAvailable(1L)).thenReturn(1);
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(lensOptionRepository.findByTypeIn(List.of("HIGH_INDEX_174", "AR_ONYX")))
                .thenReturn(List.of(lensOption1, lensOption2));
        when(prescriptionRepository.save(any(Prescription.class)))
                .thenAnswer(invocation -> {
                    Prescription p = invocation.getArgument(0);
                    p.setId(1L);
                    return p;
                });
        when(orderRepository.save(any(Order.class)))
                .thenAnswer(invocation -> {
                    Order o = invocation.getArgument(0);
                    o.setId(1L);
                    o.setOrderNumber("KL-20260514120000-1234");
                    return o;
                });

        OrderResponseDTO response = orderService.checkout(validRequest, "test@example.com");

        assertThat(response.totalAmount()).isEqualByComparingTo(new BigDecimal("1125.00"));
        assertThat(response.orderNumber()).startsWith("KL-");
        assertThat(response.status()).isEqualTo(OrderStatus.CREATED);
        assertThat(response.productName()).isEqualTo("AERO X1");
    }

    @Test
    void checkoutRejectsDuplicateLensOptions() {
        OrderRequestDTO duplicateRequest = new OrderRequestDTO(
                1L,
                List.of("HIGH_INDEX_174", "HIGH_INDEX_174"),
                new CustomerInfoDTO("John", "Doe", "test@example.com", "123 Main St"),
                new PrescriptionDetailsDTO(
                        new BigDecimal("-2.25"), new BigDecimal("-2.00"),
                        new BigDecimal("-0.50"), new BigDecimal("-0.25"),
                        180, 175,
                        new BigDecimal("63.50"))
        );

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> orderService.checkout(duplicateRequest, "test@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Duplicate lens options are not allowed");
    }

    @Test
    void checkoutRejectsInvalidProduct() {
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        OrderRequestDTO invalidProductRequest = new OrderRequestDTO(
                999L,
                List.of("HIGH_INDEX_174"),
                new CustomerInfoDTO("John", "Doe", "test@example.com", "123 Main St"),
                new PrescriptionDetailsDTO(
                        new BigDecimal("-2.25"), new BigDecimal("-2.00"),
                        new BigDecimal("-0.50"), new BigDecimal("-0.25"),
                        180, 175,
                        new BigDecimal("63.50"))
        );

        assertThatThrownBy(() -> orderService.checkout(invalidProductRequest, "test@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Selected product does not exist");
    }

    @Test
    void checkoutRejectsInvalidLensOption() {
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(lensOptionRepository.findByTypeIn(List.of("INVALID_LENS")))
                .thenReturn(List.of());

        OrderRequestDTO invalidLensRequest = new OrderRequestDTO(
                1L,
                List.of("INVALID_LENS"),
                new CustomerInfoDTO("John", "Doe", "test@example.com", "123 Main St"),
                new PrescriptionDetailsDTO(
                        new BigDecimal("-2.25"), new BigDecimal("-2.00"),
                        new BigDecimal("-0.50"), new BigDecimal("-0.25"),
                        180, 175,
                        new BigDecimal("63.50"))
        );

        assertThatThrownBy(() -> orderService.checkout(invalidLensRequest, "test@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("One or more selected lens options are invalid");
    }

    @Test
    void checkoutHandlesDuplicateLensOptionsInDatabase() {
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.decrementStockIfAvailable(1L)).thenReturn(1);
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        LensOption duplicateOption = LensOption.builder()
                .id(4L)
                .type("HIGH_INDEX_174")
                .indexValue(new BigDecimal("1.74"))
                .additionalPrice(new BigDecimal("215.00"))
                .category("LENS")
                .label("Custom Lenses (High-Index)")
                .description("Thin 1.74 index lenses for stronger prescriptions.")
                .build();

        when(lensOptionRepository.findByTypeIn(List.of("HIGH_INDEX_174")))
                .thenReturn(List.of(lensOption1, duplicateOption));

        OrderRequestDTO request = new OrderRequestDTO(
                1L,
                List.of("HIGH_INDEX_174"),
                new CustomerInfoDTO("John", "Doe", "test@example.com", "123 Main St"),
                new PrescriptionDetailsDTO(
                        new BigDecimal("-2.25"), new BigDecimal("-2.00"),
                        new BigDecimal("-0.50"), new BigDecimal("-0.25"),
                        180, 175,
                        new BigDecimal("63.50"))
        );

        when(prescriptionRepository.save(any(Prescription.class))).thenAnswer(i -> i.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        OrderResponseDTO response = orderService.checkout(request, "test@example.com");

        assertThat(response).isNotNull();
        assertThat(response.orderNumber()).startsWith("KL-");
        assertThat(response.lensOptionTypes()).containsExactly("HIGH_INDEX_174");
    }

    @Test
    void checkoutRejectsEmailMismatch() {
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(userService.findByEmailIgnoreCase("other@example.com")).thenReturn(Optional.of(user));

        OrderRequestDTO mismatchedEmailRequest = new OrderRequestDTO(
                1L,
                List.of("HIGH_INDEX_174"),
                new CustomerInfoDTO("John", "Doe", "other@example.com", "123 Main St"),
                new PrescriptionDetailsDTO(
                        new BigDecimal("-2.25"), new BigDecimal("-2.00"),
                        new BigDecimal("-0.50"), new BigDecimal("-0.25"),
                        180, 175,
                        new BigDecimal("63.50"))
        );

        assertThatThrownBy(() -> orderService.checkout(mismatchedEmailRequest, "other@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Checkout email must match the authenticated account");
    }

    @Test
    void checkoutAppliesCouponAndComputesDiscount() {
        OrderRequestDTO couponRequest = new OrderRequestDTO(
                1L,
                List.of("HIGH_INDEX_174", "AR_ONYX"),
                new CustomerInfoDTO("John", "Doe", "test@example.com", "123 Main St"),
                new PrescriptionDetailsDTO(
                        new BigDecimal("-2.25"), new BigDecimal("-2.00"),
                        new BigDecimal("-0.50"), new BigDecimal("-0.25"),
                        180, 175,
                        new BigDecimal("63.50")),
                "KLARHEIT80",
                "WECHAT"
        );

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.decrementStockIfAvailable(1L)).thenReturn(1);
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(lensOptionRepository.findByTypeIn(List.of("HIGH_INDEX_174", "AR_ONYX")))
                .thenReturn(List.of(lensOption1, lensOption2));

        com.klarheit.backend.coupon.dto.CouponValidateResponseDTO mockCouponResponse =
                new com.klarheit.backend.coupon.dto.CouponValidateResponseDTO("KLARHEIT80", "FIXED_AMOUNT", new BigDecimal("80.00"), new BigDecimal("80.00"));

        when(couponService.validateCoupon(any())).thenReturn(mockCouponResponse);

        when(prescriptionRepository.save(any(Prescription.class)))
                .thenAnswer(invocation -> {
                    Prescription p = invocation.getArgument(0);
                    p.setId(1L);
                    return p;
                });

        when(orderRepository.save(any(Order.class)))
                .thenAnswer(invocation -> {
                    Order o = invocation.getArgument(0);
                    o.setId(1L);
                    o.setOrderNumber("KL-20260514120000-1234");
                    return o;
                });

        when(paymentService.initiatePayment(any(), any(), any()))
                .thenReturn(new com.klarheit.backend.payment.PaymentInitiateResult("TX-MOCK", "weixin://wxpay/bizpayurl?pr=mock"));

        OrderResponseDTO response = orderService.checkout(couponRequest, "test@example.com");

        assertThat(response.totalAmount()).isEqualByComparingTo(new BigDecimal("1045.00"));
        assertThat(response.status()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        assertThat(response.payData()).isEqualTo("weixin://wxpay/bizpayurl?pr=mock");
    }

    @Test
    void completePaymentSuccessfullyTransitionsStatusToPaid() {
        Order order = Order.builder()
                .id(1L)
                .orderNumber("KL-123")
                .status(OrderStatus.PENDING_PAYMENT)
                .customerEmail("test@example.com")
                .totalAmount(new BigDecimal("1045.00"))
                .product(product)
                .build();

        when(orderRepository.findByOrderNumberWithWriteLock("KL-123")).thenReturn(Optional.of(order));

        orderService.completePayment("KL-123", "GATEWAY-TX-456", "WECHAT");

        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);
        assertThat(order.getGatewayTransactionId()).isEqualTo("GATEWAY-TX-456");
        assertThat(order.getPaidAt()).isNotNull();
        assertThat(order.getPaymentChannel()).isEqualTo("WECHAT");
    }

    @Test
    void completePaymentIdempotencyForAlreadyPaidOrder() {
        Order order = Order.builder()
                .id(1L)
                .orderNumber("KL-123")
                .status(OrderStatus.PAID)
                .customerEmail("test@example.com")
                .totalAmount(new BigDecimal("1045.00"))
                .product(product)
                .build();

        when(orderRepository.findByOrderNumberWithWriteLock("KL-123")).thenReturn(Optional.of(order));

        orderService.completePayment("KL-123", "GATEWAY-TX-789", "WECHAT");

        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);
        assertThat(order.getGatewayTransactionId()).isNull();
    }

    @Test
    void completePaymentIdempotencyForShippedOrder() {
        Order order = Order.builder()
                .id(1L)
                .orderNumber("KL-123")
                .status(OrderStatus.SHIPPED)
                .customerEmail("test@example.com")
                .totalAmount(new BigDecimal("1045.00"))
                .product(product)
                .build();

        when(orderRepository.findByOrderNumberWithWriteLock("KL-123")).thenReturn(Optional.of(order));

        orderService.completePayment("KL-123", "GATEWAY-TX-789", "WECHAT");

        assertThat(order.getStatus()).isEqualTo(OrderStatus.SHIPPED);
    }

    @Test
    void completePaymentMarksCancelledOrderAsRefundedWhenGatewayRefundSucceeds() {
        Order order = Order.builder()
                .id(1L)
                .orderNumber("KL-123")
                .status(OrderStatus.CANCELLED)
                .customerEmail("test@example.com")
                .totalAmount(new BigDecimal("1045.00"))
                .product(product)
                .build();

        when(orderRepository.findByOrderNumberWithWriteLock("KL-123")).thenReturn(Optional.of(order));
        when(paymentService.refundPayment(
                org.mockito.Mockito.eq("KL-123"),
                org.mockito.Mockito.eq("GATEWAY-TX-789"),
                org.mockito.Mockito.eq(new BigDecimal("1045.00")),
                org.mockito.Mockito.eq("ALIPAY"),
                org.mockito.Mockito.anyString())).thenReturn(true);

        orderService.completePayment("KL-123", "GATEWAY-TX-789", "ALIPAY");

        assertThat(order.getStatus()).isEqualTo(OrderStatus.REFUNDED);
        assertThat(order.getGatewayTransactionId()).isEqualTo("GATEWAY-TX-789");
        assertThat(order.getPaidAt()).isNotNull();
    }

    @Test
    void completePaymentMarksCancelledOrderAsRefundPendingWhenGatewayRefundFails() {
        Order order = Order.builder()
                .id(1L)
                .orderNumber("KL-123")
                .status(OrderStatus.CANCELLED)
                .customerEmail("test@example.com")
                .totalAmount(new BigDecimal("1045.00"))
                .product(product)
                .build();

        when(orderRepository.findByOrderNumberWithWriteLock("KL-123")).thenReturn(Optional.of(order));
        when(paymentService.refundPayment(any(), any(), any(), any(), any())).thenReturn(false);

        orderService.completePayment("KL-123", "GATEWAY-TX-789", "ALIPAY");

        assertThat(order.getStatus()).isEqualTo(OrderStatus.REFUND_PENDING);
        assertThat(order.getGatewayTransactionId()).isEqualTo("GATEWAY-TX-789");
    }

    @Test
    void cancelExpiredOrderTransitionsStatusToCancelledAndReleasesCouponIdempotently() {
        Order order = Order.builder()
                .id(1L)
                .orderNumber("KL-123")
                .status(OrderStatus.PENDING_PAYMENT)
                .appliedCouponCode("SALE20")
                .build();

        when(orderRepository.findByOrderNumberWithWriteLock("KL-123")).thenReturn(Optional.of(order));

        orderService.cancelExpiredOrder("KL-123");
        orderService.cancelExpiredOrder("KL-123");

        assertThat(order.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(order.isCouponReleased()).isTrue();
        org.mockito.Mockito.verify(couponService, org.mockito.Mockito.times(1)).decrementCouponUsage("SALE20");
    }

    @Test
    void cancelExpiredOrderReconcilesWithGatewayBeforeCancelling() {
        Order paidAtGateway = Order.builder()
                .id(1L)
                .orderNumber("KL-PAID-AT-GW")
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentChannel("ALIPAY")
                .totalAmount(new BigDecimal("850.00"))
                .product(product)
                .build();
        when(orderRepository.findByOrderNumberWithWriteLock("KL-PAID-AT-GW")).thenReturn(Optional.of(paidAtGateway));
        when(paymentService.queryPayment("KL-PAID-AT-GW", "ALIPAY"))
                .thenReturn(PaymentQueryResult.paid("ALI-TX-777", new BigDecimal("850.00")));

        orderService.cancelExpiredOrder("KL-PAID-AT-GW");
        assertThat(paidAtGateway.getStatus()).isEqualTo(OrderStatus.PAID);
        assertThat(paidAtGateway.getGatewayTransactionId()).isEqualTo("ALI-TX-777");

        Order unknownAtGateway = Order.builder()
                .id(2L)
                .orderNumber("KL-UNKNOWN-AT-GW")
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentChannel("ALIPAY")
                .totalAmount(new BigDecimal("850.00"))
                .build();
        when(orderRepository.findByOrderNumberWithWriteLock("KL-UNKNOWN-AT-GW")).thenReturn(Optional.of(unknownAtGateway));
        when(paymentService.queryPayment("KL-UNKNOWN-AT-GW", "ALIPAY"))
                .thenReturn(PaymentQueryResult.unknown("Gateway timeout"));

        orderService.cancelExpiredOrder("KL-UNKNOWN-AT-GW");
        assertThat(unknownAtGateway.getStatus()).isEqualTo(OrderStatus.PENDING_PAYMENT);
    }

    @Test
    void adminCancelOrderHandlesUnpaidPaidAndRejectsShipped() {
        Order unpaidOrder = Order.builder()
                .id(1L)
                .orderNumber("KL-UNPAID")
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentChannel("ALIPAY")
                .appliedCouponCode("SALE20")
                .build();
        when(orderRepository.findByOrderNumberWithWriteLock("KL-UNPAID")).thenReturn(Optional.of(unpaidOrder));

        orderService.adminCancelOrder("KL-UNPAID");
        assertThat(unpaidOrder.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(unpaidOrder.isCouponReleased()).isTrue();
        org.mockito.Mockito.verify(couponService, org.mockito.Mockito.times(1)).decrementCouponUsage("SALE20");

        Order paidOrder = Order.builder()
                .id(2L)
                .orderNumber("KL-PAID")
                .status(OrderStatus.PAID)
                .paymentChannel("ALIPAY")
                .gatewayTransactionId("ALI-TX-100")
                .totalAmount(new BigDecimal("850.00"))
                .build();
        when(orderRepository.findByOrderNumberWithWriteLock("KL-PAID")).thenReturn(Optional.of(paidOrder));
        when(paymentService.refundPayment(any(), any(), any(), any(), any())).thenReturn(false);

        orderService.adminCancelOrder("KL-PAID");
        assertThat(paidOrder.getStatus()).isEqualTo(OrderStatus.REFUND_PENDING);

        Order shippedOrder = Order.builder()
                .id(3L)
                .orderNumber("KL-SHIPPED")
                .status(OrderStatus.SHIPPED)
                .build();
        when(orderRepository.findByOrderNumberWithWriteLock("KL-SHIPPED")).thenReturn(Optional.of(shippedOrder));

        assertThatThrownBy(() -> orderService.adminCancelOrder("KL-SHIPPED"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already been shipped or delivered");
    }

    @Test
    void checkoutSnapshotsCustomerPhoneAndSingleTokenChineseName() {
        OrderRequestDTO chineseNameRequest = new OrderRequestDTO(
                1L,
                List.of("HIGH_INDEX_174"),
                new CustomerInfoDTO("张三", "", "test@example.com", "上海市静安区南京西路1号", "13800138000"),
                new PrescriptionDetailsDTO(
                        new BigDecimal("-2.25"), new BigDecimal("-2.00"),
                        new BigDecimal("-0.50"), new BigDecimal("-0.25"),
                        180, 175,
                        new BigDecimal("63.50"))
        );

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.decrementStockIfAvailable(1L)).thenReturn(1);
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(lensOptionRepository.findByTypeIn(List.of("HIGH_INDEX_174"))).thenReturn(List.of(lensOption1));
        when(prescriptionRepository.save(any(Prescription.class))).thenAnswer(i -> i.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        orderService.checkout(chineseNameRequest, "test@example.com");

        org.mockito.ArgumentCaptor<Order> orderCaptor = org.mockito.ArgumentCaptor.forClass(Order.class);
        org.mockito.Mockito.verify(orderRepository).save(orderCaptor.capture());
        Order saved = orderCaptor.getValue();
        assertThat(saved.getCustomerFirstName()).isEqualTo("张三");
        assertThat(saved.getCustomerLastName()).isEmpty();
        assertThat(saved.getCustomerPhone()).isEqualTo("13800138000");
        assertThat(saved.getShippingAddress()).isEqualTo("上海市静安区南京西路1号");
        assertThat(saved.getProductNameSnapshot()).isEqualTo("AERO X1");
        assertThat(saved.getLensOptionsSnapshot())
                .containsExactly(new OrderLensSnapshot("HIGH_INDEX_174", lensOption1.getLabel(), new BigDecimal("215.00")));
    }

    @Test
    void orderDetailsPreserveCatalogPricesAndNamesAtPurchaseTime() {
        UserAccount owner = UserAccount.builder().id(1L).email("test@example.com").build();
        product.setName("RENAMED FRAME");
        lensOption1.setLabel("Renamed lens");
        lensOption1.setAdditionalPrice(new BigDecimal("400.00"));
        Order order = Order.builder()
                .orderNumber("KL-SNAPSHOT")
                .userId(1L)
                .customerEmail("test@example.com")
                .product(product)
                .lensOptions(List.of(lensOption1))
                .productNameSnapshot("AERO X1")
                .lensOptionsSnapshot(List.of(new OrderLensSnapshot(
                        "HIGH_INDEX_174", "Original lens", new BigDecimal("215.00"))))
                .build();
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(owner));
        when(orderRepository.findByOrderNumber("KL-SNAPSHOT")).thenReturn(Optional.of(order));

        var details = orderService.getOrderDetails("KL-SNAPSHOT", "test@example.com");

        assertThat(details.productName()).isEqualTo("AERO X1");
        assertThat(details.lensOptions()).singleElement().satisfies(option -> {
            assertThat(option.label()).isEqualTo("Original lens");
            assertThat(option.additionalPrice()).isEqualByComparingTo("215.00");
        });
    }

    @Test
    void getOrderDetails_adminRole_allowedToViewCustomerOrder() {
        UserAccount admin = UserAccount.builder()
                .id(999L)
                .email("admin@klarheit.com")
                .role("ADMIN")
                .build();

        Order bobsOrder = Order.builder()
                .orderNumber("KL-12345")
                .userId(200L)
                .customerFirstName("Bob")
                .customerLastName("Smith")
                .customerEmail("bob@example.com")
                .customerPhone("13900001111")
                .shippingAddress("456 Road")
                .status(OrderStatus.PAID)
                .totalAmount(new BigDecimal("850.00"))
                .product(product)
                .lensOptions(List.of())
                .build();

        when(userService.findByEmailIgnoreCase("admin@klarheit.com")).thenReturn(Optional.of(admin));
        when(orderRepository.findByOrderNumber("KL-12345")).thenReturn(Optional.of(bobsOrder));

        var detail = orderService.getOrderDetails("KL-12345", "admin@klarheit.com");
        assertThat(detail.orderNumber()).isEqualTo("KL-12345");
        assertThat(detail.customerPhone()).isEqualTo("13900001111");
    }

    @Test
    void checkoutOrderNumberCollisionRetrySuccess() {
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.decrementStockIfAvailable(1L)).thenReturn(1);
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(lensOptionRepository.findByTypeIn(List.of("HIGH_INDEX_174", "AR_ONYX")))
                .thenReturn(List.of(lensOption1, lensOption2));
        when(prescriptionRepository.save(any(Prescription.class)))
                .thenAnswer(invocation -> {
                    Prescription p = invocation.getArgument(0);
                    p.setId(1L);
                    return p;
                });

        org.springframework.dao.DataIntegrityViolationException dive = new org.springframework.dao.DataIntegrityViolationException("Duplicate key");

        Order successfulOrder = Order.builder()
                .id(1L)
                .orderNumber("KL-20260514120000-1234")
                .status(OrderStatus.CREATED)
                .totalAmount(new BigDecimal("1125.00"))
                .product(product)
                .lensOptions(List.of(lensOption1, lensOption2))
                .build();

        when(orderRepository.save(any(Order.class)))
                .thenThrow(dive)
                .thenThrow(dive)
                .thenThrow(dive)
                .thenReturn(successfulOrder);

        OrderResponseDTO response = orderService.checkout(validRequest, "test@example.com");

        assertThat(response).isNotNull();
        assertThat(response.orderNumber()).isEqualTo("KL-20260514120000-1234");
        org.mockito.Mockito.verify(orderRepository, org.mockito.Mockito.times(4)).save(any(Order.class));
    }

    @Test
    void checkoutOrderNumberCollisionRetryFailure() {
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.decrementStockIfAvailable(1L)).thenReturn(1);
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(lensOptionRepository.findByTypeIn(List.of("HIGH_INDEX_174", "AR_ONYX")))
                .thenReturn(List.of(lensOption1, lensOption2));
        when(prescriptionRepository.save(any(Prescription.class)))
                .thenAnswer(invocation -> {
                    Prescription p = invocation.getArgument(0);
                    p.setId(1L);
                    return p;
                });

        org.springframework.dao.DataIntegrityViolationException dive = new org.springframework.dao.DataIntegrityViolationException("Duplicate key");

        when(orderRepository.save(any(Order.class))).thenThrow(dive);

        assertThatThrownBy(() -> orderService.checkout(validRequest, "test@example.com"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Failed to generate a unique order number after 5 attempts");

        org.mockito.Mockito.verify(orderRepository, org.mockito.Mockito.times(5)).save(any(Order.class));
    }

    @Test
    void getOrderDetails_unauthorized_throwsIllegalArgumentException() {
        UserAccount john = UserAccount.builder()
                .id(100L)
                .email("john@example.com")
                .build();

        Order bobsOrder = Order.builder()
                .userId(200L)
                .customerEmail("bob@example.com")
                .build();

        bobsOrder.setProduct(product);
        bobsOrder.setLensOptions(List.of());

        when(userService.findByEmailIgnoreCase("john@example.com")).thenReturn(Optional.of(john));
        when(orderRepository.findByOrderNumber("KL-12345")).thenReturn(Optional.of(bobsOrder));

        assertThatThrownBy(() -> orderService.getOrderDetails("KL-12345", "john@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unauthorized to view this order.");
    }

    @Test
    void adminCancelOrderRetainsPendingPaymentFailsExplicitlyAndCompletesRefundOnSubsequentReconciliation() {
        Order unknownStatusOrder = Order.builder()
                .id(10L)
                .orderNumber("KL-ADMIN-UNKNOWN")
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentChannel("ALIPAY")
                .totalAmount(new BigDecimal("850.00"))
                .appliedCouponCode("SALE20")
                .build();
        when(orderRepository.findByOrderNumberWithWriteLock("KL-ADMIN-UNKNOWN"))
                .thenReturn(Optional.of(unknownStatusOrder));
        when(paymentService.queryPayment("KL-ADMIN-UNKNOWN", "ALIPAY"))
                .thenReturn(PaymentQueryResult.unknown("Gateway timeout"));

        assertThatThrownBy(() -> orderService.adminCancelOrder("KL-ADMIN-UNKNOWN"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("支付状态核对中，暂未取消，请稍后重试");

        assertThat(unknownStatusOrder.getStatus()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        assertThat(unknownStatusOrder.isCouponReleased()).isFalse();
        assertThat(unknownStatusOrder.isCancelRequested()).isTrue();

        // Subsequent reconciliation discovers the order was actually PAID at gateway ->
        // because cancelRequested=true, it must trigger refund instead of turning the order into PAID
        when(paymentService.queryPayment("KL-ADMIN-UNKNOWN", "ALIPAY"))
                .thenReturn(PaymentQueryResult.paid("ALI-TX-LATE-99", new BigDecimal("850.00")));
        when(paymentService.refundPayment(any(), any(), any(), any(), any())).thenReturn(true);

        orderService.cancelExpiredOrder("KL-ADMIN-UNKNOWN");

        assertThat(unknownStatusOrder.getStatus()).isEqualTo(OrderStatus.REFUNDED);
        assertThat(unknownStatusOrder.getGatewayTransactionId()).isEqualTo("ALI-TX-LATE-99");
        assertThat(unknownStatusOrder.isCouponReleased()).isTrue();
        org.mockito.Mockito.verify(couponService, org.mockito.Mockito.times(1)).decrementCouponUsage("SALE20");

        Order closeFailedOrder = Order.builder()
                .id(11L)
                .orderNumber("KL-ADMIN-CLOSE-FAIL")
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentChannel("ALIPAY")
                .appliedCouponCode("SALE30")
                .build();
        when(orderRepository.findByOrderNumberWithWriteLock("KL-ADMIN-CLOSE-FAIL"))
                .thenReturn(Optional.of(closeFailedOrder));
        when(paymentService.queryPayment("KL-ADMIN-CLOSE-FAIL", "ALIPAY"))
                .thenReturn(PaymentQueryResult.unpaid());
        when(paymentService.closePayment("KL-ADMIN-CLOSE-FAIL", "ALIPAY"))
                .thenReturn(false);

        assertThatThrownBy(() -> orderService.adminCancelOrder("KL-ADMIN-CLOSE-FAIL"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("支付状态核对中，暂未取消，请稍后重试");

        assertThat(closeFailedOrder.getStatus()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        assertThat(closeFailedOrder.isCouponReleased()).isFalse();
        assertThat(closeFailedOrder.isCancelRequested()).isTrue();
        org.mockito.Mockito.verify(couponService, org.mockito.Mockito.never()).decrementCouponUsage("SALE30");
    }

    @Test
    void refundRetryUsesPersistedActualPaidAmountInsteadOfOrderTotalAmount() {
        Order cancelledOrder = Order.builder()
                .id(20L)
                .orderNumber("KL-REFUND-800")
                .status(OrderStatus.CANCELLED)
                .paymentChannel("ALIPAY")
                .totalAmount(new BigDecimal("1000.00"))
                .build();
        when(orderRepository.findByOrderNumberWithWriteLock("KL-REFUND-800"))
                .thenReturn(Optional.of(cancelledOrder));
        // First refund fails, second refund (retry) succeeds
        when(paymentService.refundPayment(any(), any(), any(), any(), any()))
                .thenReturn(false)
                .thenReturn(true);

        // Late payment callback arrives with actual paid amount 800.00 (order total is 1000.00)
        orderService.completePayment("KL-REFUND-800", "ALI-TX-800", "ALIPAY", new BigDecimal("800.00"));

        assertThat(cancelledOrder.getStatus()).isEqualTo(OrderStatus.REFUND_PENDING);
        assertThat(cancelledOrder.getRefundAmount()).isEqualByComparingTo("800.00");
        assertThat(cancelledOrder.getRefundRequestId()).isEqualTo("KL-REFUND-800-REFUND");

        // Retry pending refund
        orderService.retryPendingRefund("KL-REFUND-800");

        assertThat(cancelledOrder.getStatus()).isEqualTo(OrderStatus.REFUNDED);

        org.mockito.ArgumentCaptor<BigDecimal> amountCaptor = org.mockito.ArgumentCaptor.forClass(BigDecimal.class);
        org.mockito.Mockito.verify(paymentService, org.mockito.Mockito.times(2))
                .refundPayment(
                        org.mockito.ArgumentMatchers.eq("KL-REFUND-800"),
                        org.mockito.ArgumentMatchers.eq("ALI-TX-800"),
                        amountCaptor.capture(),
                        org.mockito.ArgumentMatchers.eq("ALIPAY"),
                        org.mockito.ArgumentMatchers.anyString());

        assertThat(amountCaptor.getAllValues())
                .hasSize(2)
                .allSatisfy(amount -> assertThat(amount).isEqualByComparingTo("800.00"));
    }

    @Test
    void checkoutRejectsWhenKillSwitchIsPaused() {
        var settingService = org.mockito.Mockito.mock(com.klarheit.backend.settings.SystemSettingService.class);
        when(settingService.isCheckoutEnabled()).thenReturn(false);
        when(settingService.getCheckoutPauseReason()).thenReturn("验配产能已达本周上限");
        orderService.setSystemSettingService(settingService);

        assertThatThrownBy(() -> orderService.checkout(validRequest, "test@example.com"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("验配产能已达本周上限");
    }

    @Test
    void checkoutEnforcesIdempotencyKeyAndPreventsDuplicateOrders() {
        Order existingOrder = Order.builder()
                .id(77L)
                .orderNumber("KL-IDEMP-01")
                .status(OrderStatus.PAID)
                .totalAmount(new BigDecimal("1125.00"))
                .productNameSnapshot("AERO X1")
                .lensOptionsSnapshot(List.of(new OrderLensSnapshot("HIGH_INDEX_174", "1.74", new BigDecimal("215.00"))))
                .build();

        OrderRequestDTO idempotentReq = new OrderRequestDTO(
                1L,
                List.of("HIGH_INDEX_174"),
                new CustomerInfoDTO("John", "Doe", "test@example.com", "123 Main St"),
                validRequest.prescription(),
                null,
                "ALIPAY",
                "titanium",
                "idem-key-123",
                "John Doe",
                false
        );

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(orderRepository.findByUserIdAndIdempotencyKey(1L, "idem-key-123"))
                .thenReturn(Optional.of(existingOrder));

        OrderResponseDTO response = orderService.checkout(idempotentReq, "test@example.com");

        assertThat(response.orderNumber()).isEqualTo("KL-IDEMP-01");
        assertThat(response.status()).isEqualTo(OrderStatus.PAID);
        org.mockito.Mockito.verify(productRepository, org.mockito.Mockito.never()).decrementStockIfAvailable(any());
        org.mockito.Mockito.verify(orderRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void checkoutRejectsWhenLastUnitSoldOutConcurrently() {
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(lensOptionRepository.findByTypeIn(List.of("HIGH_INDEX_174", "AR_ONYX")))
                .thenReturn(List.of(lensOption1, lensOption2));
        when(productRepository.decrementStockIfAvailable(1L)).thenReturn(0);

        assertThatThrownBy(() -> orderService.checkout(validRequest, "test@example.com"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("售罄");
    }

    @Test
    void checkoutRejectsCoatingOnlyOrMultipleBaseLenses() {
        LensOption base1 = LensOption.builder().id(1L).type("STANDARD_156").category("LENS").additionalPrice(BigDecimal.ZERO).build();
        LensOption base2 = LensOption.builder().id(2L).type("HIGH_INDEX_174").category("LENS").additionalPrice(new BigDecimal("215.00")).build();
        LensOption coating = LensOption.builder().id(3L).type("AR_ONYX").category("COATING").additionalPrice(new BigDecimal("60.00")).build();

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        // Coating only -> rejected
        OrderRequestDTO coatingOnly = new OrderRequestDTO(1L, List.of("AR_ONYX"), validRequest.customer(), validRequest.prescription());
        when(lensOptionRepository.findByTypeIn(List.of("AR_ONYX"))).thenReturn(List.of(coating));
        assertThatThrownBy(() -> orderService.checkout(coatingOnly, "test@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("基础镜片");

        // Two base lenses -> rejected
        OrderRequestDTO twoBases = new OrderRequestDTO(1L, List.of("STANDARD_156", "HIGH_INDEX_174"), validRequest.customer(), validRequest.prescription());
        when(lensOptionRepository.findByTypeIn(List.of("STANDARD_156", "HIGH_INDEX_174"))).thenReturn(List.of(base1, base2));
        assertThatThrownBy(() -> orderService.checkout(twoBases, "test@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("仅可选择一款基础镜片");
    }

    @Test
    void checkoutRejectsZeroAmountGatewayOrder() {
        OrderRequestDTO zeroOrder = new OrderRequestDTO(
                1L, List.of("HIGH_INDEX_174"), validRequest.customer(), validRequest.prescription(), "FREE100", "ALIPAY");
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(lensOptionRepository.findByTypeIn(List.of("HIGH_INDEX_174"))).thenReturn(List.of(lensOption1));
        when(couponService.validateCoupon(any())).thenReturn(
                new com.klarheit.backend.coupon.dto.CouponValidateResponseDTO("FREE100", "FIXED_AMOUNT", new BigDecimal("2000.00"), new BigDecimal("1065.00")));

        assertThatThrownBy(() -> orderService.checkout(zeroOrder, "test@example.com"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("零元订单");
    }

    @Test
    void cancelExpiredOrderChecksPaidAmountMismatchOnConcurrentCloseRecheckAndReleasesStock() {
        Order order = Order.builder()
                .id(30L)
                .orderNumber("KL-RECHECK-MISMATCH")
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentChannel("ALIPAY")
                .totalAmount(new BigDecimal("1000.00"))
                .product(product)
                .build();
        when(orderRepository.findByOrderNumberWithWriteLock("KL-RECHECK-MISMATCH")).thenReturn(Optional.of(order));
        when(paymentService.queryPayment("KL-RECHECK-MISMATCH", "ALIPAY"))
                .thenReturn(PaymentQueryResult.unpaid())
                .thenReturn(PaymentQueryResult.paid("ALI-TX-MISMATCH", new BigDecimal("1.00")));
        when(paymentService.closePayment("KL-RECHECK-MISMATCH", "ALIPAY")).thenReturn(false);
        when(paymentService.refundPayment(any(), any(), any(), any(), any())).thenReturn(true);

        orderService.cancelExpiredOrder("KL-RECHECK-MISMATCH");

        assertThat(order.getStatus()).isEqualTo(OrderStatus.REFUNDED);
        assertThat(order.getRefundAmount()).isEqualByComparingTo("1.00");
        assertThat(order.isStockReleased()).isTrue();
        org.mockito.Mockito.verify(productRepository).incrementStock(1L);
    }

    @Test
    void resumePaymentDiscoversAlreadyPaidOrderAndAvoidsDoublePayment() {
        Order order = Order.builder()
                .id(40L)
                .orderNumber("KL-RESUME-1")
                .userId(1L)
                .customerEmail("test@example.com")
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentChannel("ALIPAY")
                .totalAmount(new BigDecimal("850.00"))
                .productNameSnapshot("AERO X1")
                .build();
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(orderRepository.findByOrderNumberWithWriteLock("KL-RESUME-1")).thenReturn(Optional.of(order));
        when(paymentService.queryPayment("KL-RESUME-1", "ALIPAY"))
                .thenReturn(PaymentQueryResult.paid("ALI-TX-ALREADY", new BigDecimal("850.00")));

        OrderResponseDTO result = orderService.resumePayment("KL-RESUME-1", "test@example.com", "ALIPAY");

        assertThat(result.status()).isEqualTo(OrderStatus.PAID);
        assertThat(result.payData()).isNull();
        org.mockito.Mockito.verify(paymentService, org.mockito.Mockito.never()).initiatePayment(any(), any(), any());
    }

    @Test
    void getMyOrdersUsesProductSnapshotWhenProductIsNull() {
        Order archivedProductOrder = Order.builder()
                .orderNumber("KL-SNAP-ONLY")
                .status(OrderStatus.DELIVERED)
                .totalAmount(new BigDecimal("850.00"))
                .product(null)
                .productNameSnapshot("ARCHIVED FRAME")
                .lensOptionsSnapshot(List.of(new OrderLensSnapshot("HIGH_INDEX_174", "1.74", new BigDecimal("215.00"))))
                .build();
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(archivedProductOrder));

        var orders = orderService.getMyOrders("test@example.com");
        assertThat(orders).singleElement().satisfies(o -> {
            assertThat(o.productName()).isEqualTo("ARCHIVED FRAME");
            assertThat(o.lensOptionTypes()).containsExactly("HIGH_INDEX_174");
        });
    }

    @Test
    void adminFulfillmentBlocksShippingWhenNeedsInfoAndMarksDelivered() {
        Order order = Order.builder()
                .id(50L)
                .orderNumber("KL-FULFILL-1")
                .status(OrderStatus.PAID)
                .customerEmail("test@example.com")
                .productNameSnapshot("AERO X1")
                .fulfillmentStatus(com.klarheit.backend.order.FulfillmentStatus.NEEDS_INFO)
                .build();
        when(orderRepository.findByOrderNumberWithWriteLock("KL-FULFILL-1")).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.adminShipOrder("KL-FULFILL-1", "SF", "SF123"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("待补资料");

        // Illegal direct jump NEEDS_INFO -> QC_PASSED is rejected (P0-04)
        assertThatThrownBy(() -> orderService.adminUpdateFulfillment("KL-FULFILL-1", "QC_PASSED", "跳步", java.time.LocalDate.now().plusDays(7)))
                .isInstanceOf(IllegalStateException.class);

        // Proper optical workflow: optician verify -> IN_PRODUCTION -> QC PASSED -> SHIP -> DELIVER
        orderService.adminVerifyOpticianPrescription("KL-FULFILL-1", "瞳距已复核通过", "optician@klarheit.com");
        orderService.adminStartProduction("KL-FULFILL-1", java.time.LocalDate.now().plusDays(7), "开始加工", "optician@klarheit.com");
        orderService.adminRecordQcResult("KL-FULFILL-1", "PASSED", "光学中心与镀膜质检合格", "qc@klarheit.com");
        assertThat(order.getFulfillmentStatus()).isEqualTo("QC_PASSED");

        orderService.adminShipOrder("KL-FULFILL-1", "SF Express", "SF123456");
        assertThat(order.getStatus()).isEqualTo(OrderStatus.SHIPPED);
        org.mockito.Mockito.verify(emailService).sendShippingNotification("test@example.com", "KL-FULFILL-1", "AERO X1", "SF Express", "SF123456");

        orderService.adminDeliverOrder("KL-FULFILL-1");
        assertThat(order.getStatus()).isEqualTo(OrderStatus.DELIVERED);
        assertThat(order.getDeliveredAt()).isNotNull();
    }
}
