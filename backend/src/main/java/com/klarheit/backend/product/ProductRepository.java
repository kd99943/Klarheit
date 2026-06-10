package com.klarheit.backend.product;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, Long> {
    @Override
    @EntityGraph(attributePaths = {"arConfigs"})
    List<Product> findAll();

    @EntityGraph(attributePaths = {"arConfigs"})
    Page<Product> findAll(Pageable pageable);
}
