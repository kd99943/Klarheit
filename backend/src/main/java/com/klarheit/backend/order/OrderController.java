package com.klarheit.backend.order;

import com.klarheit.backend.order.dto.CustomerInfoDTO;
import com.klarheit.backend.order.dto.OrderDetailResponseDTO;
import com.klarheit.backend.order.dto.OrderRequestDTO;
import com.klarheit.backend.order.dto.OrderResponseDTO;
import com.klarheit.backend.order.dto.OrderSummaryDTO;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    @PostMapping("/delivery-estimate")
    public ResponseEntity<DeliveryPolicyService.DeliveryEstimate> estimateDelivery(
            @RequestBody CustomerInfoDTO customer) {
        return ResponseEntity.ok(orderService.estimateDelivery(customer, customer != null ? customer.phone() : null));
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
    public ResponseEntity<Map<String, String>> getOrderStatus(@PathVariable String orderNumber) {
        return ResponseEntity.ok(Map.of("status", orderService.getOrderStatusOnly(orderNumber)));
    }

    @GetMapping("/{orderNumber}")
    public ResponseEntity<OrderDetailResponseDTO> getOrderDetails(
            @PathVariable String orderNumber, Authentication authentication) {
        return ResponseEntity.ok(orderService.getOrderDetails(orderNumber, authentication.getName()));
    }

    @PostMapping("/{orderNumber}/resume-payment")
    public ResponseEntity<OrderResponseDTO> resumePayment(
            @PathVariable String orderNumber,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication) {
        String channel = body != null ? body.get("paymentChannel") : null;
        return ResponseEntity.ok(orderService.resumePayment(orderNumber, authentication.getName(), channel));
    }

    @PostMapping("/{orderNumber}/refresh-payment")
    public ResponseEntity<OrderDetailResponseDTO> refreshPaymentStatus(
            @PathVariable String orderNumber,
            Authentication authentication) {
        return ResponseEntity.ok(orderService.refreshPaymentStatus(orderNumber, authentication.getName()));
    }

    @PostMapping("/{orderNumber}/confirm-quote")
    public ResponseEntity<OrderResponseDTO> confirmQuoteAndPay(
            @PathVariable String orderNumber,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication) {
        String channel = body != null && body.get("paymentChannel") != null
                ? String.valueOf(body.get("paymentChannel"))
                : null;
        Integer expectedQuoteVersion = null;
        if (body != null && body.get("quoteVersion") != null && !String.valueOf(body.get("quoteVersion")).isBlank()) {
            expectedQuoteVersion = Integer.valueOf(String.valueOf(body.get("quoteVersion")).trim());
        }
        return ResponseEntity.ok(orderService.customerConfirmQuoteAndPay(
                orderNumber, authentication.getName(), channel, expectedQuoteVersion));
    }

    @PostMapping("/{orderNumber}/cancel")
    public ResponseEntity<OrderDetailResponseDTO> cancelMyOrder(
            @PathVariable String orderNumber,
            Authentication authentication) {
        return ResponseEntity.ok(orderService.customerCancelOrder(orderNumber, authentication.getName()));
    }
}
