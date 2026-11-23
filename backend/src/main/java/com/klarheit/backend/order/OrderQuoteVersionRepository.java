package com.klarheit.backend.order;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderQuoteVersionRepository extends JpaRepository<OrderQuoteVersion, Long> {
    List<OrderQuoteVersion> findByOrderNumberOrderByVersionNumberDesc(String orderNumber);

    Optional<OrderQuoteVersion> findByOrderNumberAndVersionNumber(String orderNumber, Integer versionNumber);
}
