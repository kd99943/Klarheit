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
import com.klarheit.backend.order.OrderRepository;
import com.klarheit.backend.order.OrderService;
import com.klarheit.backend.order.dto.CustomerInfoDTO;
import com.klarheit.backend.order.dto.OrderRequestDTO;
import com.klarheit.backend.order.dto.OrderResponseDTO;
import com.klarheit.backend.order.dto.PrescriptionDetailsDTO;
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

        // base price (850) + lens (215 + 60) = 1125
        assertThat(response.totalAmount()).isEqualByComparingTo(new BigDecimal("1125.00"));
        assertThat(response.orderNumber()).startsWith("KL-");
        assertThat(response.status()).isEqualTo("CREATED");
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
        // Return fewer lens options than requested (simulating invalid option)
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

        // base price (850) + lens (215 + 60) - discount (80) = 1045
        assertThat(response.totalAmount()).isEqualByComparingTo(new BigDecimal("1045.00"));
        assertThat(response.status()).isEqualTo("PENDING_PAYMENT");
        assertThat(response.payData()).isEqualTo("weixin://wxpay/bizpayurl?pr=mock");
    }

    @Test
    void completePaymentSuccessfullyTransitionsStatusToPaid() {
        Order order = Order.builder()
                .id(1L)
                .orderNumber("KL-123")
                .status("PENDING_PAYMENT")
                .customerEmail("test@example.com")
                .totalAmount(new BigDecimal("1045.00"))
                .product(product)
                .build();

        when(orderRepository.findByOrderNumber("KL-123")).thenReturn(Optional.of(order));
        
        orderService.completePayment("KL-123", "GATEWAY-TX-456", "WECHAT");

        assertThat(order.getStatus()).isEqualTo("PAID");
        assertThat(order.getGatewayTransactionId()).isEqualTo("GATEWAY-TX-456");
        assertThat(order.getPaidAt()).isNotNull();
        assertThat(order.getPaymentChannel()).isEqualTo("WECHAT");
    }
}
