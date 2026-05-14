package com.klarheit.backend.product;

import com.klarheit.backend.product.dto.ProductResponseDTO;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ProductService {
    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public List<ProductResponseDTO> getCatalog() {
        return productRepository.findAll().stream()
                .map(product -> new ProductResponseDTO(
                        product.getId(),
                        product.getName(),
                        product.getMaterial(),
                        product.getBasePrice(),
                        product.getImageUrl()))
                .toList();
    }
}
