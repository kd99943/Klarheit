package com.klarheit.backend.payment;

import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderRepository;
import com.klarheit.backend.order.OrderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
public class PaymentReconciliationScheduler {

    private final OrderRepository orderRepository;
    private final OrderService orderService;

    public PaymentReconciliationScheduler(OrderRepository orderRepository, OrderService orderService) {
        this.orderRepository = orderRepository;
        this.orderService = orderService;
    }

    /**
     * Scan and cancel orders that have been in CREATED or PENDING_PAYMENT status
     * for more than 30 minutes. Runs every 5 minutes.
     */
    @Scheduled(cron = "0 */5 * * * *")
    public void cleanExpiredOrders() {
        log.info("Starting scheduled reconciliation job to clean expired unpaid orders...");
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(30);
        List<Order> expiredOrders = orderRepository.findExpiredOrders(cutoff);
        log.info("Found {} expired unpaid orders to clean up.", expiredOrders.size());

        for (Order order : expiredOrders) {
            try {
                orderService.cancelExpiredOrder(order.getOrderNumber());
            } catch (Exception e) {
                log.error("Failed to cancel expired order: {}", order.getOrderNumber(), e);
            }
        }
        log.info("Scheduled reconciliation job completed.");
    }
}
