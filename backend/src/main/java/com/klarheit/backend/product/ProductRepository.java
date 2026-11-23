package com.klarheit.backend.product;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, Long> {
    @Override
    @EntityGraph(attributePaths = {"arConfigs"})
    List<Product> findAll();

    @EntityGraph(attributePaths = {"arConfigs"})
    Page<Product> findAll(Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"arConfigs"})
    Optional<Product> findById(Long id);

    @Modifying(clearAutomatically = false, flushAutomatically = true)
    @Query("update Product p set p.stockQuantity = p.stockQuantity - 1 where p.id = :id and p.stockQuantity >= 1 and p.salesStatus = 'AVAILABLE'")
    int decrementStockIfAvailable(@Param("id") Long id);

    @Modifying(clearAutomatically = false, flushAutomatically = true)
    @Query("update Product p set p.stockQuantity = p.stockQuantity + 1 where p.id = :id")
    int incrementStock(@Param("id") Long id);

    @Modifying(clearAutomatically = false, flushAutomatically = true)
    @Query("update Product p set p.stockQuantity = :stockQuantity where p.id = :id")
    int updateStockQuantity(@Param("id") Long id, @Param("stockQuantity") int stockQuantity);
}
