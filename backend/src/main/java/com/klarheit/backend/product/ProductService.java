package com.klarheit.backend.product;

import com.klarheit.backend.product.dto.ProductRequestDTO;
import com.klarheit.backend.product.dto.ProductResponseDTO;
import com.klarheit.backend.product.dto.ProductArConfigDTO;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class ProductService {
    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @Cacheable("productCatalog")
    public List<ProductResponseDTO> getCatalog() {
        return productRepository.findAll().stream()
                .map(this::toResponseDTO)
                .toList();
    }

    public List<ProductResponseDTO> getCatalogFiltered(String search, String material, String shape, BigDecimal minPrice, BigDecimal maxPrice, String sortBy) {
        return productRepository.findAll().stream()
                .filter(p -> {
                    if (search != null && !search.isBlank()) {
                        String s = search.toLowerCase().trim();
                        boolean matchName = (p.getNameEn() != null && p.getNameEn().toLowerCase().contains(s)) ||
                                            (p.getNameZh() != null && p.getNameZh().toLowerCase().contains(s));
                        if (!matchName) return false;
                    }
                    if (material != null && !material.isBlank()) {
                        String mat = material.trim();
                        boolean matchMaterial = (p.getMaterialEn() != null && p.getMaterialEn().equalsIgnoreCase(mat)) ||
                                                (p.getMaterialZh() != null && p.getMaterialZh().equalsIgnoreCase(mat));
                        if (!matchMaterial) return false;
                    }
                    if (shape != null && !shape.isBlank()) {
                        if (p.getShape() == null || !p.getShape().equalsIgnoreCase(shape.trim())) {
                            return false;
                        }
                    }
                    if (minPrice != null && (p.getBasePrice() == null || p.getBasePrice().compareTo(minPrice) < 0)) {
                        return false;
                    }
                    if (maxPrice != null && (p.getBasePrice() == null || p.getBasePrice().compareTo(maxPrice) > 0)) {
                        return false;
                    }
                    return true;
                })
                .map(this::toResponseDTO)
                .sorted((p1, p2) -> {
                    if ("price_asc".equalsIgnoreCase(sortBy)) {
                        return safeCompare(p1.basePrice(), p2.basePrice());
                    } else if ("price_desc".equalsIgnoreCase(sortBy)) {
                        return safeCompare(p2.basePrice(), p1.basePrice());
                    }
                    return p1.id().compareTo(p2.id()); // Default sort by ID
                })
                .toList();
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ProductResponseDTO getProductById(Long id) {
        return productRepository.findById(id)
                .map(this::toResponseDTO)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Product not found: " + id));
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

    private static int safeCompare(BigDecimal a, BigDecimal b) {
        if (a == null && b == null) return 0;
        if (a == null) return -1;
        if (b == null) return 1;
        return a.compareTo(b);
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
                product.getShape(),
                product.getSpecsSize(),
                product.getDetailImages(),
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

    @org.springframework.transaction.annotation.Transactional
    @CacheEvict(value = "productCatalog", allEntries = true)
    public ProductResponseDTO createProduct(ProductRequestDTO request) {
        Product product = Product.builder()
                .nameEn(request.nameEn().trim())
                .nameZh(request.nameZh().trim())
                .materialEn(request.materialEn().trim())
                .materialZh(request.materialZh().trim())
                .basePrice(request.basePrice())
                .imageUrl(request.imageUrl().trim())
                .shape(request.shape() != null ? request.shape().trim() : "ROUND")
                .specsSize(request.specsSize() != null ? request.specsSize().trim() : "52-18-145")
                .detailImages(request.detailImages())
                .build();
        Product saved = productRepository.save(product);
        return toResponseDTO(saved);
    }

    @org.springframework.transaction.annotation.Transactional
    @CacheEvict(value = "productCatalog", allEntries = true)
    public ProductResponseDTO updateProduct(Long id, ProductRequestDTO request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));
        product.setNameEn(request.nameEn().trim());
        product.setNameZh(request.nameZh().trim());
        product.setMaterialEn(request.materialEn().trim());
        product.setMaterialZh(request.materialZh().trim());
        product.setBasePrice(request.basePrice());
        product.setImageUrl(request.imageUrl().trim());
        product.setShape(request.shape() != null ? request.shape().trim() : "ROUND");
        product.setSpecsSize(request.specsSize() != null ? request.specsSize().trim() : "52-18-145");
        product.setDetailImages(request.detailImages());
        // keep legacy name and material fields in sync with English values
        product.setName(request.nameEn().trim());
        product.setMaterial(request.materialEn().trim());
        
        Product saved = productRepository.save(product);
        return toResponseDTO(saved);
    }

    @org.springframework.transaction.annotation.Transactional
    @CacheEvict(value = "productCatalog", allEntries = true)
    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));
        productRepository.delete(product);
    }
}
