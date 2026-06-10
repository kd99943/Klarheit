package com.klarheit.backend.product;

import com.klarheit.backend.product.dto.ProductResponseDTO;
import com.klarheit.backend.product.dto.ProductArConfigDTO;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class ProductService {
    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public List<ProductResponseDTO> getCatalog() {
        return productRepository.findAll().stream()
                .map(this::toResponseDTO)
                .toList();
    }

    public List<ProductArConfigDTO> getGlobalArConfigs() {
        return getCatalog().stream()
                .flatMap(p -> p.arConfigs().stream())
                .toList();
    }

    public Page<ProductResponseDTO> getCatalogPaged(Pageable pageable) {
        return productRepository.findAll(pageable)
                .map(this::toResponseDTO);
    }

    private ProductResponseDTO toResponseDTO(Product product) {
        return new ProductResponseDTO(
                product.getId(),
                product.getName(),
                product.getMaterial(),
                product.getNameEn(),
                product.getNameZh(),
                product.getMaterialEn(),
                product.getMaterialZh(),
                product.getBasePrice(),
                product.getImageUrl(),
                product.getArConfigs().stream()
                        .map(ar -> new ProductArConfigDTO(
                                ar.getFinishId(),
                                product.getName(),
                                product.getNameEn(),
                                product.getNameZh(),
                                ar.getFinishLabelKey(),
                                ar.getLensLabel(),
                                ar.getLensLabelEn(),
                                ar.getLensLabelZh(),
                                ar.getFitLabelKey(),
                                ar.getFrameColor(),
                                ar.getLensColor(),
                                ar.getModelUrl(),
                                new ProductArConfigDTO.TransformOffsetDTO(
                                        List.of(ar.getPositionX(), ar.getPositionY(), ar.getPositionZ()),
                                        List.of(ar.getRotationX(), ar.getRotationY(), ar.getRotationZ()),
                                        ar.getScale()
                                )
                        ))
                        .toList());
    }
}
