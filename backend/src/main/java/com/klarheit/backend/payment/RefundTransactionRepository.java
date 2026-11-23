package com.klarheit.backend.payment;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefundTransactionRepository extends JpaRepository<RefundTransaction, Long> {
    Optional<RefundTransaction> findByRefundRequestId(String refundRequestId);

    List<RefundTransaction> findByOrderNumberOrderByRequestedAtAsc(String orderNumber);

    List<RefundTransaction> findByTicketNumberOrderByRequestedAtAsc(String ticketNumber);

    List<RefundTransaction> findByStatusIn(List<String> statuses);

    List<RefundTransaction> findByOrderNumberIn(Collection<String> orderNumbers);

    /**
     * Sec 6 P1: Indexed period query for confirmed refunds attributed by confirmedAt timestamp.
     */
    @Query("""
            select r from RefundTransaction r
            where upper(r.status) = 'CONFIRMED'
              and (:fromInclusive is null or coalesce(r.confirmedAt, r.requestedAt) >= :fromInclusive)
              and (:toExclusive is null or coalesce(r.confirmedAt, r.requestedAt) < :toExclusive)
            """)
    List<RefundTransaction> findConfirmedRefundsInPeriod(
            @Param("fromInclusive") LocalDateTime fromInclusive,
            @Param("toExclusive") LocalDateTime toExclusive);
}
