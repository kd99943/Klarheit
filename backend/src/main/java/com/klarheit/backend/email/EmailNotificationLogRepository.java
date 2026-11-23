package com.klarheit.backend.email;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailNotificationLogRepository extends JpaRepository<EmailNotificationLog, Long> {
    Optional<EmailNotificationLog> findByEventKey(String eventKey);

    Page<EmailNotificationLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<EmailNotificationLog> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    long countByStatus(String status);
}
