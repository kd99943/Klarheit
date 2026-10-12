package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderRepository;
import com.klarheit.backend.order.OrderService;
import com.klarheit.backend.payment.PaymentReconciliationScheduler;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PaymentReconciliationSchedulerTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private OrderService orderService;

    @InjectMocks
    private PaymentReconciliationScheduler scheduler;

    @Test
    void cleanExpiredOrdersSuccessfullyCancelsAll() {
        // Arrange
        Order order1 = Order.builder().orderNumber("KL-1111").build();
        Order order2 = Order.builder().orderNumber("KL-2222").build();
        List<Order> expiredOrders = List.of(order1, order2);

        ArgumentCaptor<LocalDateTime> cutoffCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        when(orderRepository.findExpiredOrders(cutoffCaptor.capture())).thenReturn(expiredOrders);

        // Act
        scheduler.cleanExpiredOrders();

        // Assert
        assertThat(cutoffCaptor.getValue()).isBeforeOrEqualTo(LocalDateTime.now().minusMinutes(29));
        verify(orderService).cancelExpiredOrder("KL-1111");
        verify(orderService).cancelExpiredOrder("KL-2222");
    }

    @Test
    void cleanExpiredOrdersResilienceWhenOneThrowsException() {
        // Arrange
        Order order1 = Order.builder().orderNumber("KL-1111").build();
        Order order2 = Order.builder().orderNumber("KL-2222").build();
        Order order3 = Order.builder().orderNumber("KL-3333").build();
        List<Order> expiredOrders = List.of(order1, order2, order3);

        when(orderRepository.findExpiredOrders(any(LocalDateTime.class))).thenReturn(expiredOrders);

        // Throw an exception on the second order
        doThrow(new RuntimeException("Simulated failure")).when(orderService).cancelExpiredOrder("KL-2222");

        // Act
        scheduler.cleanExpiredOrders();

        // Assert
        verify(orderService).cancelExpiredOrder("KL-1111");
        verify(orderService).cancelExpiredOrder("KL-2222");
        verify(orderService).cancelExpiredOrder("KL-3333");
    }
}
