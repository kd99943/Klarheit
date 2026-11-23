package com.klarheit.backend.order;

import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, Long> {
    @Override
    @EntityGraph(attributePaths = {"product", "lensOptions"})
    Page<Order> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"product", "lensOptions", "prescription"})
    Optional<Order> findByOrderNumber(String orderNumber);

    @EntityGraph(attributePaths = {"product", "lensOptions"})
    List<Order> findByUserIdOrderByCreatedAtDesc(Long userId);

    @EntityGraph(attributePaths = {"product", "lensOptions"})
    Page<Order> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.orderNumber = :orderNumber")
    Optional<Order> findByOrderNumberWithWriteLock(@Param("orderNumber") String orderNumber);

    @Query("select o from Order o where o.status in ('CREATED', 'PENDING_PAYMENT') and (coalesce(o.customerQuoteConfirmedAt, o.createdAt) < :cutoff or o.cancelRequested = true)")
    List<Order> findExpiredOrders(@Param("cutoff") LocalDateTime cutoff);

    /**
     * P0-02: Find AWAITING_REVIEW orders whose optician review hold deadline has passed.
     */
    @Query("select o from Order o where o.status = 'AWAITING_REVIEW' and ((o.reviewExpiresAt is not null and o.reviewExpiresAt < :now) or (o.reviewExpiresAt is null and o.createdAt < :fallbackCutoff))")
    List<Order> findExpiredAwaitingReviewOrders(@Param("now") LocalDateTime now, @Param("fallbackCutoff") LocalDateTime fallbackCutoff);

    /**
     * P0-02: Find QUOTE_READY orders whose customer quote confirmation hold deadline has passed.
     */
    @Query("select o from Order o where o.status = 'QUOTE_READY' and ((o.quoteExpiresAt is not null and o.quoteExpiresAt < :now) or (o.quoteExpiresAt is null and coalesce(o.opticianVerifiedAt, o.createdAt) < :fallbackCutoff))")
    List<Order> findExpiredQuoteReadyOrders(@Param("now") LocalDateTime now, @Param("fallbackCutoff") LocalDateTime fallbackCutoff);

    @Query("select o from Order o where o.status in ('CREATED', 'PENDING_PAYMENT', 'AWAITING_REVIEW', 'QUOTE_READY') and o.cancelRequested = true")
    List<Order> findCancelRequestedOrders();

    @Query("select o from Order o where o.status = :status")
    List<Order> findByStatus(@Param("status") String status);

    /**
     * P0-02: Find AWAITING_REVIEW (within 12h of expiry) or QUOTE_READY (within 24h of expiry) orders
     * that have not yet received a proactive expiry reminder.
     */
    @Query("""
            select o from Order o
            where o.expiryReminderSentAt is null
              and (
                (o.status = 'AWAITING_REVIEW' and o.reviewExpiresAt is not null and o.reviewExpiresAt > :now and o.reviewExpiresAt <= :reviewWindowEnd)
                or (o.status = 'QUOTE_READY' and o.quoteExpiresAt is not null and o.quoteExpiresAt > :now and o.quoteExpiresAt <= :quoteWindowEnd)
              )
            """)
    List<Order> findOrdersNeedingExpiryReminder(
            @Param("now") LocalDateTime now,
            @Param("reviewWindowEnd") LocalDateTime reviewWindowEnd,
            @Param("quoteWindowEnd") LocalDateTime quoteWindowEnd);

    /**
     * Sec 6 P1: Indexed period query for paid receipts (avoids full-table scan when reconciling a date range).
     */
    @Query("""
            select o from Order o
            where o.paidAt is not null
              and (:fromInclusive is null or o.paidAt >= :fromInclusive)
              and (:toExclusive is null or o.paidAt < :toExclusive)
            order by o.paidAt desc
            """)
    List<Order> findPaidOrdersInPeriod(
            @Param("fromInclusive") LocalDateTime fromInclusive,
            @Param("toExclusive") LocalDateTime toExclusive);

    List<Order> findByOrderNumberIn(Collection<String> orderNumbers);

    Optional<Order> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);

    @EntityGraph(attributePaths = {"product", "lensOptions"})
    @Query("""
            select o from Order o
            where (:status is null or upper(o.status) = upper(:status))
              and (:fulfillmentStatus is null or upper(o.fulfillmentStatus) = upper(:fulfillmentStatus))
              and (:search is null
                   or lower(o.orderNumber) like lower(concat('%', :search, '%'))
                   or lower(o.customerEmail) like lower(concat('%', :search, '%'))
                   or lower(coalesce(o.customerPhone, '')) like lower(concat('%', :search, '%')))
            order by o.createdAt desc
            """)
    Page<Order> searchOrdersForAdmin(
            @Param("status") String status,
            @Param("fulfillmentStatus") String fulfillmentStatus,
            @Param("search") String search,
            Pageable pageable);

    @EntityGraph(attributePaths = {"product", "lensOptions"})
    @Query("""
            select o from Order o
            where (
                (o.status in ('CREATED', 'PENDING_PAYMENT') and coalesce(o.customerQuoteConfirmedAt, o.createdAt) < :paymentCutoff)
                or (o.status = 'AWAITING_REVIEW' and ((o.reviewExpiresAt is not null and o.reviewExpiresAt < :now) or (o.reviewExpiresAt is null and o.createdAt < :reviewFallbackCutoff)))
                or (o.status = 'QUOTE_READY' and ((o.quoteExpiresAt is not null and o.quoteExpiresAt < :now) or (o.quoteExpiresAt is null and coalesce(o.opticianVerifiedAt, o.createdAt) < :quoteFallbackCutoff)))
            )
              and (:search is null
                   or lower(o.orderNumber) like lower(concat('%', :search, '%'))
                   or lower(o.customerEmail) like lower(concat('%', :search, '%'))
                   or lower(coalesce(o.customerPhone, '')) like lower(concat('%', :search, '%')))
            order by o.createdAt asc
            """)
    Page<Order> searchOverdueHoldOrdersForAdmin(
            @Param("now") LocalDateTime now,
            @Param("paymentCutoff") LocalDateTime paymentCutoff,
            @Param("reviewFallbackCutoff") LocalDateTime reviewFallbackCutoff,
            @Param("quoteFallbackCutoff") LocalDateTime quoteFallbackCutoff,
            @Param("search") String search,
            Pageable pageable);
}
