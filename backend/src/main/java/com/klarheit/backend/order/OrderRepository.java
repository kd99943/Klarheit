package com.klarheit.backend.order;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {
    @EntityGraph(attributePaths = {"lensOptions"})
    Optional<Order> findByOrderNumber(String orderNumber);

    @EntityGraph(attributePaths = {"product", "lensOptions"})
    List<Order> findByUserIdOrderByCreatedAtDesc(Long userId);

    @EntityGraph(attributePaths = {"product", "lensOptions"})
    Page<Order> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}
