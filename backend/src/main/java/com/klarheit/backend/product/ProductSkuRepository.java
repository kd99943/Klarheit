package com.klarheit.backend.product;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductSkuRepository extends JpaRepository<ProductSku, Long> {

    List<ProductSku> findByProductIdOrderByIdAsc(Long productId);

    List<ProductSku> findByProductIdInOrderByIdAsc(List<Long> productIds);

    List<ProductSku> findByProductIdAndFinishIdOrderByIdAsc(Long productId, String finishId);

    Optional<ProductSku> findByProductIdAndFinishIdAndSizeSpec(Long productId, String finishId, String sizeSpec);

    Optional<ProductSku> findFirstByProductIdAndFinishIdOrderByIdAsc(Long productId, String finishId);

    /**
     * Sum live available quantity (max(onHand - reserved - committed, 0)) directly in SQL,
     * bypassing Hibernate L1 entity cache after bulk atomic updates.
     */
    @Query("select coalesce(sum(case when s.onHandQty > (s.reservedQty + s.committedQty) " +
           "then (s.onHandQty - s.reservedQty - s.committedQty) else 0 end), 0) " +
           "from ProductSku s where s.product.id = :productId and s.salesStatus = 'AVAILABLE'")
    Integer sumAvailableQtyByProductId(@Param("productId") Long productId);

    /**
     * Atomically reserve 1 available unit (onHandQty - reservedQty - committedQty >= 1) for an active SKU.
     * Prevents concurrent overselling when two customers compete for the last pair.
     */
    @Modifying(clearAutomatically = false, flushAutomatically = true)
    @Query("update ProductSku s set s.reservedQty = s.reservedQty + 1 " +
           "where s.id = :id and s.salesStatus = 'AVAILABLE' and (s.onHandQty - s.reservedQty - s.committedQty) >= 1")
    int reserveStockIfAvailable(@Param("id") Long id);

    /**
     * Convert 1 reserved unit into committed physical consumption upon payment confirmation.
     */
    @Modifying(clearAutomatically = false, flushAutomatically = true)
    @Query("update ProductSku s " +
           "set s.onHandQty = case when s.onHandQty >= 1 then s.onHandQty - 1 else 0 end, " +
           "    s.reservedQty = case when s.reservedQty >= 1 then s.reservedQty - 1 else 0 end " +
           "where s.id = :id")
    int commitReservedStock(@Param("id") Long id);

    /**
     * Release 1 reserved unit when an unpaid/review/quote order is cancelled or expires.
     */
    @Modifying(clearAutomatically = false, flushAutomatically = true)
    @Query("update ProductSku s " +
           "set s.reservedQty = case when s.reservedQty >= 1 then s.reservedQty - 1 else 0 end " +
           "where s.id = :id")
    int releaseReservedStock(@Param("id") Long id);

    /**
     * Return 1 unit to physical on-hand stock (pre-ship paid cancel or post-return QC restockable).
     */
    @Modifying(clearAutomatically = false, flushAutomatically = true)
    @Query("update ProductSku s set s.onHandQty = s.onHandQty + 1 where s.id = :id")
    int incrementOnHandStock(@Param("id") Long id);
}
