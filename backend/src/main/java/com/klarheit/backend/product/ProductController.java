package com.klarheit.backend.product;

import com.klarheit.backend.product.dto.ProductResponseDTO;
import com.klarheit.backend.product.dto.ProductArConfigDTO;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/products")
public class ProductController {
    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ResponseEntity<List<ProductResponseDTO>> getProducts() {
        return ResponseEntity.ok(productService.getCatalog());
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
