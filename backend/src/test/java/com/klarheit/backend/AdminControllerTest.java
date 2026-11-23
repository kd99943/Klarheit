package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.klarheit.backend.audit.AuditLogService;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.order.AdminController;
import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderRepository;
import com.klarheit.backend.order.OrderStatus;
import com.klarheit.backend.order.dto.OrderDetailResponseDTO;
import com.klarheit.backend.order.dto.OrderSummaryDTO;
import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

@ExtendWith(MockitoExtension.class)
class AdminControllerTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private UserAccountRepository userAccountRepository;

    @Mock
    private ProductService productService;

    @Mock
    private AuditLogService auditLogService;

    private AdminController adminController;

    private Order testOrder;

    @BeforeEach
    void setUp() {
        adminController = new AdminController(orderRepository, userAccountRepository, productService, auditLogService);

        Product product = Product.builder()
                .id(1L)
                .name("AERO X1")
                .build();

        testOrder = Order.builder()
                .id(1L)
                .orderNumber("KL-12345")
                .status(OrderStatus.PAID)
                .customerFirstName("John")
                .customerLastName("Doe")
                .customerEmail("john@example.com")
                .customerPhone("13800138000")
                .shippingAddress("123 Main St")
                .product(product)
                .totalAmount(new BigDecimal("1000.00"))
                .build();
    }

    private Authentication mockAuth(String email) {
        Authentication auth = mock(Authentication.class);
        lenient().when(auth.getName()).thenReturn(email);
        return auth;
    }

    @Test
    void getAllOrdersReturnsPagedData() {
        Pageable pageable = PageRequest.of(0, 20);
        Page<Order> orderPage = new PageImpl<>(List.of(testOrder), pageable, 1);
        when(orderRepository.findAll(pageable)).thenReturn(orderPage);

        ResponseEntity<Page<OrderSummaryDTO>> response = adminController.getAllOrders(pageable);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getContent()).hasSize(1);
        assertThat(response.getBody().getContent().get(0).orderNumber()).isEqualTo("KL-12345");
        assertThat(response.getBody().getContent().get(0).productName()).isEqualTo("AERO X1");
    }

    @Test
    void getOrderDetailsReturnsAdminOrderDetail() {
        when(orderRepository.findByOrderNumber("KL-12345")).thenReturn(Optional.of(testOrder));

        ResponseEntity<OrderDetailResponseDTO> response = adminController.getOrderDetails("KL-12345");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().orderNumber()).isEqualTo("KL-12345");
        assertThat(response.getBody().customerPhone()).isEqualTo("13800138000");
    }

    @Test
    void shipOrderSuccessfully() {
        when(orderRepository.findByOrderNumber("KL-12345")).thenReturn(Optional.of(testOrder));

        ResponseEntity<Void> response = adminController.shipOrder("KL-12345", Map.of(
                "carrier", "SF Express",
                "trackingNumber", "SF99999"
        ), mockAuth("admin@klarheit.com"));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(testOrder.getStatus()).isEqualTo(OrderStatus.SHIPPED);
        assertThat(testOrder.getCarrier()).isEqualTo("SF Express");
        assertThat(testOrder.getTrackingNumber()).isEqualTo("SF99999");
        verify(orderRepository).save(testOrder);
        verify(auditLogService).log(eq("admin@klarheit.com"), eq("SHIP_ORDER"), eq("ORDER"), eq("KL-12345"), anyString());
    }

    @Test
    void shipOrderThrowsForInvalidStatus() {
        testOrder.setStatus(OrderStatus.CREATED);
        when(orderRepository.findByOrderNumber("KL-12345")).thenReturn(Optional.of(testOrder));

        assertThatThrownBy(() -> adminController.shipOrder("KL-12345", Map.of(
                "carrier", "SF Express",
                "trackingNumber", "SF99999"
        ), mockAuth("admin@klarheit.com"))).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only PAID orders can be shipped");
    }

    @Test
    void cancelUnpaidOrderTransitionsToCancelledAndPaidOrderTransitionsToRefundPending() {
        testOrder.setStatus(OrderStatus.PENDING_PAYMENT);
        when(orderRepository.findByOrderNumber("KL-12345")).thenReturn(Optional.of(testOrder));

        ResponseEntity<Void> response = adminController.cancelOrder("KL-12345", mockAuth("admin@klarheit.com"));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(testOrder.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        verify(orderRepository).save(testOrder);
        verify(auditLogService).log(eq("admin@klarheit.com"), eq("CANCEL_ORDER"), eq("ORDER"), eq("KL-12345"), anyString());

        testOrder.setStatus(OrderStatus.PAID);
        adminController.cancelOrder("KL-12345", mockAuth("admin@klarheit.com"));
        assertThat(testOrder.getStatus()).isEqualTo(OrderStatus.REFUND_PENDING);
    }

    @Test
    void cancelOrderWhenDeferredLogsCancelOrderFailedAndRethrowsConflict() {
        com.klarheit.backend.order.OrderService mockedOrderService = mock(com.klarheit.backend.order.OrderService.class);
        AdminController controllerWithOrderService = new AdminController(
                orderRepository,
                userAccountRepository,
                productService,
                auditLogService,
                mockedOrderService,
                null
        );
        when(mockedOrderService.adminCancelOrder("KL-UNKNOWN-99"))
                .thenThrow(new com.klarheit.backend.order.OrderCancellationDeferredException("支付状态核对中，暂未取消，请稍后重试"));

        assertThatThrownBy(() -> controllerWithOrderService.cancelOrder("KL-UNKNOWN-99", mockAuth("admin@klarheit.com")))
                .isInstanceOf(com.klarheit.backend.order.OrderCancellationDeferredException.class)
                .hasMessage("支付状态核对中，暂未取消，请稍后重试");

        verify(auditLogService).log(
                eq("admin@klarheit.com"),
                eq("CANCEL_ORDER_FAILED"),
                eq("ORDER"),
                eq("KL-UNKNOWN-99"),
                contains("支付状态核对中，暂未取消，请稍后重试"));
        verify(auditLogService, never()).log(
                eq("admin@klarheit.com"),
                eq("CANCEL_ORDER"),
                eq("ORDER"),
                eq("KL-UNKNOWN-99"),
                anyString());

        com.klarheit.backend.config.ApiExceptionHandler exceptionHandler = new com.klarheit.backend.config.ApiExceptionHandler();
        var errorResponse = exceptionHandler.handleIllegalState(
                new com.klarheit.backend.order.OrderCancellationDeferredException("支付状态核对中，暂未取消，请稍后重试"));
        assertThat(errorResponse.getStatusCode().value()).isEqualTo(409);
        assertThat(errorResponse.getBody()).isNotNull();
        assertThat(errorResponse.getBody().message()).isEqualTo("支付状态核对中，暂未取消，请稍后重试");
    }

    @Test
    void getStatsReturnsDashboardStats() {
        when(orderRepository.count()).thenReturn(10L);
        when(userAccountRepository.count()).thenReturn(5L);
        when(orderRepository.findAll()).thenReturn(List.of(testOrder));

        ResponseEntity<Map<String, Object>> response = adminController.getDashboardStats();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        Map<String, Object> body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.get("totalOrders")).isEqualTo(10L);
        assertThat(body.get("totalUsers")).isEqualTo(5L);
        assertThat(body.get("totalSales")).isEqualTo(new BigDecimal("1000.00"));
        assertThat(body.get("averageOrderValue")).isEqualTo(new BigDecimal("1000.00"));
    }

    @Test
    void getAllProductsReturnsList() {
        com.klarheit.backend.product.dto.ProductResponseDTO responseDTO = new com.klarheit.backend.product.dto.ProductResponseDTO(
                1L, "AERO X1", "Titanium", new BigDecimal("850.00"), "/img.png", "ROUND", "52-18-145", null, List.of()
        );
        when(productService.getCatalog()).thenReturn(List.of(responseDTO));

        ResponseEntity<List<com.klarheit.backend.product.dto.ProductResponseDTO>> response = adminController.getAllProducts();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(1);
        assertThat(response.getBody().get(0).name()).isEqualTo("AERO X1");
    }

    @Test
    void createProductSuccessfully() {
        com.klarheit.backend.product.dto.ProductRequestDTO requestDTO = new com.klarheit.backend.product.dto.ProductRequestDTO(
                "AERO X1", "AERO X1", "Titanium", "Titanium", new BigDecimal("850.00"), "/img.png", "ROUND", "52-18-145", null
        );
        com.klarheit.backend.product.dto.ProductResponseDTO responseDTO = new com.klarheit.backend.product.dto.ProductResponseDTO(
                1L, "AERO X1", "Titanium", new BigDecimal("850.00"), "/img.png", "ROUND", "52-18-145", null, List.of()
        );
        when(productService.createProduct(requestDTO)).thenReturn(responseDTO);

        ResponseEntity<com.klarheit.backend.product.dto.ProductResponseDTO> response = adminController.createProduct(requestDTO, mockAuth("admin@klarheit.com"));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().name()).isEqualTo("AERO X1");
        verify(auditLogService).log(eq("admin@klarheit.com"), eq("CREATE_PRODUCT"), eq("PRODUCT"), eq("1"), anyString());
    }

    @Test
    void updateProductSuccessfully() {
        com.klarheit.backend.product.dto.ProductRequestDTO requestDTO = new com.klarheit.backend.product.dto.ProductRequestDTO(
                "AERO X2", "AERO X2", "Gold", "Gold", new BigDecimal("950.00"), "/img2.png", "SQUARE", "54-18-145", null
        );
        com.klarheit.backend.product.dto.ProductResponseDTO responseDTO = new com.klarheit.backend.product.dto.ProductResponseDTO(
                1L, "AERO X2", "Gold", new BigDecimal("950.00"), "/img2.png", "SQUARE", "54-18-145", null, List.of()
        );
        when(productService.updateProduct(1L, requestDTO)).thenReturn(responseDTO);

        ResponseEntity<com.klarheit.backend.product.dto.ProductResponseDTO> response = adminController.updateProduct(1L, requestDTO, mockAuth("admin@klarheit.com"));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().name()).isEqualTo("AERO X2");
        verify(auditLogService).log(eq("admin@klarheit.com"), eq("UPDATE_PRODUCT"), eq("PRODUCT"), eq("1"), anyString());
    }

    @Test
    void deleteProductSuccessfully() {
        ResponseEntity<Void> response = adminController.deleteProduct(1L, mockAuth("admin@klarheit.com"));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(productService).deleteProduct(1L);
        verify(auditLogService).log(eq("admin@klarheit.com"), eq("DELETE_PRODUCT"), eq("PRODUCT"), eq("1"), any());
    }

    @Test
    void getAllUsersReturnsPagedData() {
        com.klarheit.backend.auth.UserAccount user = com.klarheit.backend.auth.UserAccount.builder()
                .id(1L)
                .email("user@example.com")
                .firstName("John")
                .lastName("Doe")
                .role("USER")
                .build();
        Pageable pageable = PageRequest.of(0, 20);
        Page<com.klarheit.backend.auth.UserAccount> userPage = new PageImpl<>(List.of(user), pageable, 1);
        when(userAccountRepository.findAll(pageable)).thenReturn(userPage);

        ResponseEntity<Page<com.klarheit.backend.auth.dto.UserProfileDTO>> response = adminController.getAllUsers(pageable);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getContent()).hasSize(1);
        assertThat(response.getBody().getContent().get(0).email()).isEqualTo("user@example.com");
        assertThat(response.getBody().getContent().get(0).role()).isEqualTo("USER");
    }
}
