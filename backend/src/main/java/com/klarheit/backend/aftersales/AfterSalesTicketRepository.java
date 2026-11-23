package com.klarheit.backend.aftersales;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AfterSalesTicketRepository extends JpaRepository<AfterSalesTicket, Long> {
    List<AfterSalesTicket> findByOrderNumberOrderByCreatedAtDesc(String orderNumber);
    List<AfterSalesTicket> findByOrderNumberIn(Collection<String> orderNumbers);
    Optional<AfterSalesTicket> findByTicketNumber(String ticketNumber);
    Page<AfterSalesTicket> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<AfterSalesTicket> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);
    long countByStatusIn(List<String> statuses);

    @Query("select count(t) from AfterSalesTicket t where upper(t.status) in ('OPEN', 'AWAITING_CUSTOMER', 'IN_PROGRESS') and t.updatedAt < :cutoff")
    long countOverdueOpenTickets(@Param("cutoff") LocalDateTime cutoff);
}
