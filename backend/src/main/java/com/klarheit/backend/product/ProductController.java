package com.klarheit.backend.product;

import com.klarheit.backend.product.dto.ProductResponseDTO;
import com.klarheit.backend.product.dto.ProductArConfigDTO;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/products")
public class ProductController {
    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ResponseEntity<List<ProductResponseDTO>> getProducts(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String material,
            @RequestParam(required = false) String shape,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) String sortBy) {
        if (search != null || material != null || shape != null || minPrice != null || maxPrice != null || sortBy != null) {
            return ResponseEntity.ok(productService.getCatalogFiltered(search, material, shape, minPrice, maxPrice, sortBy));
        }
        return ResponseEntity.ok(productService.getCatalog());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductResponseDTO> getProductById(@PathVariable Long id) {
        return ResponseEntity.ok(productService.getProductById(id));
    }

    @GetMapping("/paged")
    public ResponseEntity<Page<ProductResponseDTO>> getProductsPaged(
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(productService.getCatalogPaged(pageable));
    }

    @GetMapping("/ar-configs")
    public ResponseEntity<List<ProductArConfigDTO>> getArConfigs() {
        return ResponseEntity.ok(productService.getGlobalArConfigs());
    }
}
