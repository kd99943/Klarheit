package com.klarheit.backend.order;

import com.klarheit.backend.audit.AuditLogService;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.auth.dto.UserProfileDTO;
import com.klarheit.backend.order.dto.OrderSummaryDTO;
import com.klarheit.backend.product.ProductService;
import com.klarheit.backend.product.dto.ProductRequestDTO;
import com.klarheit.backend.product.dto.ProductResponseDTO;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
    private static final String TARGET_ORDER = "ORDER";
    private static final String TARGET_PRODUCT = "PRODUCT";

    private final OrderRepository orderRepository;
    private final UserAccountRepository userAccountRepository;
    private final ProductService productService;
    private final AuditLogService auditLogService;

    public AdminController(OrderRepository orderRepository,
                           UserAccountRepository userAccountRepository,
                           ProductService productService,
                           AuditLogService auditLogService) {
        this.orderRepository = orderRepository;
        this.userAccountRepository = userAccountRepository;
        this.productService = productService;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/orders")
    public ResponseEntity<Page<OrderSummaryDTO>> getAllOrders(
            @PageableDefault(size = 20) Pageable pageable) {
        Page<OrderSummaryDTO> orders = orderRepository.findAll(pageable)
                .map(order -> new OrderSummaryDTO(
                        order.getOrderNumber(),
                        order.getStatus(),
                        order.getTotalAmount(),
                        order.getProduct().getName(),
                        order.getLensOptionTypes(),
                        order.getCreatedAt()
                ));
        return ResponseEntity.ok(orders);
    }

    @PostMapping("/orders/{orderNumber}/ship")
    @Transactional
    public ResponseEntity<Void> shipOrder(
            @PathVariable String orderNumber,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        String carrier = request.get("carrier");
        String trackingNumber = request.get("trackingNumber");
        if (carrier == null || carrier.isBlank() || trackingNumber == null || trackingNumber.isBlank()) {
            throw new IllegalArgumentException("Carrier and tracking number are required.");
        }

        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (!OrderStatus.PAID.equalsIgnoreCase(order.getStatus()) && !OrderStatus.SHIPPED.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalArgumentException("Only PAID orders can be shipped.");
        }

        order.setStatus(OrderStatus.SHIPPED);
        order.setCarrier(carrier.trim());
        order.setTrackingNumber(trackingNumber.trim());
        orderRepository.save(order);

        auditLogService.log(authentication.getName(), "SHIP_ORDER", TARGET_ORDER, orderNumber,
                "carrier=" + carrier.trim() + "; trackingNumber=" + trackingNumber.trim());

        return ResponseEntity.ok().build();
    }

    @PostMapping("/orders/{orderNumber}/cancel")
    @Transactional
    public ResponseEntity<Void> cancelOrder(@PathVariable String orderNumber, Authentication authentication) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        String previousStatus = order.getStatus();
        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);

        auditLogService.log(authentication.getName(), "CANCEL_ORDER", TARGET_ORDER, orderNumber,
                "previousStatus=" + previousStatus);

        return ResponseEntity.ok().build();
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        long totalOrders = orderRepository.count();
        long totalUsers = userAccountRepository.count();

        List<Order> paidOrders = orderRepository.findAll().stream()
                .filter(o -> OrderStatus.PAID.equalsIgnoreCase(o.getStatus()) || OrderStatus.SHIPPED.equalsIgnoreCase(o.getStatus()))
                .toList();

        BigDecimal totalSales = paidOrders.stream()
                .map(Order::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal averageOrderValue = BigDecimal.ZERO;
        if (!paidOrders.isEmpty()) {
            averageOrderValue = totalSales.divide(BigDecimal.valueOf(paidOrders.size()), 2, RoundingMode.HALF_UP);
        }

        return ResponseEntity.ok(Map.of(
                "totalOrders", totalOrders,
                "totalUsers", totalUsers,
                "totalSales", totalSales,
                "averageOrderValue", averageOrderValue
        ));
    }

    // ── Product Management CRUD ────────────────────────────────

    @GetMapping("/products")
    public ResponseEntity<List<ProductResponseDTO>> getAllProducts() {
        return ResponseEntity.ok(productService.getCatalog());
    }

    @PostMapping("/products")
    public ResponseEntity<ProductResponseDTO> createProduct(@RequestBody ProductRequestDTO request,
                                                             Authentication authentication) {
        ProductResponseDTO created = productService.createProduct(request);
        auditLogService.log(authentication.getName(), "CREATE_PRODUCT", TARGET_PRODUCT,
                String.valueOf(created.id()), "name=" + created.nameEn());
        return ResponseEntity.ok(created);
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<ProductResponseDTO> updateProduct(
            @PathVariable Long id,
            @RequestBody ProductRequestDTO request,
            Authentication authentication) {
        ProductResponseDTO updated = productService.updateProduct(id, request);
        auditLogService.log(authentication.getName(), "UPDATE_PRODUCT", TARGET_PRODUCT,
                String.valueOf(id), "name=" + updated.nameEn());
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id, Authentication authentication) {
        productService.deleteProduct(id);
        auditLogService.log(authentication.getName(), "DELETE_PRODUCT", TARGET_PRODUCT,
                String.valueOf(id), null);
        return ResponseEntity.ok().build();
    }

    // ── User Management Directory ──────────────────────────────

    @GetMapping("/users")
    public ResponseEntity<Page<UserProfileDTO>> getAllUsers(
            @PageableDefault(size = 20) Pageable pageable) {
        Page<UserProfileDTO> users = userAccountRepository.findAll(pageable)
                .map(user -> new UserProfileDTO(
                        user.getId(),
                        user.getEmail(),
                        user.getFirstName(),
                        user.getLastName(),
                        user.getPhone(),
                        user.isPhoneVerified(),
                        user.getRole()
                ));
        return ResponseEntity.ok(users);
    }
}
