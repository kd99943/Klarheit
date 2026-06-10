package com.klarheit.backend.order;

import com.klarheit.backend.order.dto.OrderRequestDTO;
import com.klarheit.backend.order.dto.OrderResponseDTO;
import com.klarheit.backend.order.dto.OrderSummaryDTO;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {
    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/checkout")
    public ResponseEntity<OrderResponseDTO> checkout(@Valid @RequestBody OrderRequestDTO request, Authentication authentication) {
        return ResponseEntity.ok(orderService.checkout(request, authentication.getName()));
    }

    @GetMapping("/my")
    public ResponseEntity<List<OrderSummaryDTO>> myOrders(Authentication authentication) {
        return ResponseEntity.ok(orderService.getMyOrders(authentication.getName()));
    }

    @GetMapping("/my/paged")
    public ResponseEntity<Page<OrderSummaryDTO>> myOrdersPaged(
            Authentication authentication,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(orderService.getMyOrdersPaged(authentication.getName(), pageable));
    }

    @GetMapping("/{orderNumber}/status")
    public ResponseEntity<java.util.Map<String, String>> getOrderStatus(@org.springframework.web.bind.annotation.PathVariable String orderNumber) {
        return ResponseEntity.ok(java.util.Map.of("status", orderService.getOrderStatusOnly(orderNumber)));
    }
}
