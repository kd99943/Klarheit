package com.klarheit.backend.order;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderShipmentEventRepository extends JpaRepository<OrderShipmentEvent, Long> {
    List<OrderShipmentEvent> findByOrderNumberOrderByCreatedAtAsc(String orderNumber);
}
