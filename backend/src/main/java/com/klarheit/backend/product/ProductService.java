package com.klarheit.backend.product;

import com.klarheit.backend.order.BusinessClock;
import com.klarheit.backend.product.dto.ProductArConfigDTO;
import com.klarheit.backend.product.dto.ProductRequestDTO;
import com.klarheit.backend.product.dto.ProductResponseDTO;
import com.klarheit.backend.product.dto.ProductSkuDTO;
import com.klarheit.backend.product.dto.ProductSkuUpsertDTO;
import com.klarheit.backend.product.dto.StocktakeItemDTO;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class ProductService {
    private final ProductRepository productRepository;

    @Autowired(required = false)
    private ProductSkuRepository productSkuRepository;

    @Autowired(required = false)
    private CacheManager cacheManager;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public void setProductSkuRepository(ProductSkuRepository productSkuRepository) {
        this.productSkuRepository = productSkuRepository;
    }

    @Cacheable("productCatalog")
    public List<ProductResponseDTO> getCatalog() {
        List<Product> active = productRepository.findAll().stream()
                .filter(p -> !ProductSalesStatus.ARCHIVED.equalsIgnoreCase(p.getSalesStatus()))
                .toList();
        return mapProductsWithSkus(active, true);
    }

    /**
     * Internal/admin catalog projection including archived items, exact on-hand/reserved/committed
     * stock, supplier names, and unit costs.
     */
    public List<ProductResponseDTO> getAllCatalogIncludingArchived() {
        return mapProductsWithSkus(productRepository.findAll(), false);
    }

    public List<ProductResponseDTO> getCatalogFiltered(String search, String material, String shape, BigDecimal minPrice, BigDecimal maxPrice, String sortBy) {
        List<Product> filtered = productRepository.findAll().stream()
                .filter(p -> !ProductSalesStatus.ARCHIVED.equalsIgnoreCase(p.getSalesStatus()))
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
                .toList();
        return mapProductsWithSkus(filtered, true).stream()
                .sorted((p1, p2) -> {
                    if ("price_asc".equalsIgnoreCase(sortBy)) {
                        return safeCompare(p1.basePrice(), p2.basePrice());
                    } else if ("price_desc".equalsIgnoreCase(sortBy)) {
                        return safeCompare(p2.basePrice(), p1.basePrice());
                    }
                    return p1.id().compareTo(p2.id());
                })
                .toList();
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ProductResponseDTO getProductById(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Product not found: " + id));
        List<ProductSku> skus = loadSkuEntitiesForProduct(product.getId());
        return toResponseDTO(product, skus, true);
    }

    public List<ProductArConfigDTO> getGlobalArConfigs() {
        return getCatalog().stream()
                .flatMap(p -> p.arConfigs().stream())
                .toList();
    }

    public Page<ProductResponseDTO> getCatalogPaged(Pageable pageable) {
        Page<Product> page = productRepository.findAll(pageable);
        Map<Long, List<ProductSku>> skuMap = loadSkuEntityMap(page.getContent());
        return page.map(p -> toResponseDTO(p, skuMap.getOrDefault(p.getId(), List.of()), true));
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<ProductSkuDTO> getSkusForProduct(Long productId) {
        if (!productRepository.existsById(productId)) {
            throw new IllegalArgumentException("Product not found: " + productId);
        }
        return loadSkuEntitiesForProduct(productId).stream().map(this::toAdminSkuDTO).toList();
    }

    @org.springframework.transaction.annotation.Transactional
    @CacheEvict(value = "productCatalog", allEntries = true)
    public ProductSkuDTO upsertSku(Long productId, ProductSkuUpsertDTO request) {
        return upsertSkuInternal(productId, request, null, null, false);
    }

    /**
     * Batch import verified physical stocktake counts for SKUs (P0-02).
     * Uncounted SKUs remain untouched (staying PAUSED/unverified if not yet stocktaken).
     */
    @org.springframework.transaction.annotation.Transactional
    @CacheEvict(value = "productCatalog", allEntries = true)
    public List<ProductSkuDTO> importPhysicalStocktake(List<StocktakeItemDTO> items, String operatorEmail) {
        if (productSkuRepository == null) {
            throw new IllegalStateException("SKU repository is not configured.");
        }
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("实盘导入清单不能为空。");
        }
        List<ProductSkuDTO> imported = new ArrayList<>();
        Set<Long> affectedProductIds = new LinkedHashSet<>();
        LocalDateTime now = BusinessClock.now();
        String verifier = (operatorEmail != null && !operatorEmail.isBlank()) ? operatorEmail.trim() : "warehouse";

        for (StocktakeItemDTO item : items) {
            Product product = productRepository.findById(item.productId())
                    .orElseThrow(() -> new IllegalArgumentException("Product not found: " + item.productId()));
            String finishId = item.finishId().trim();
            String sizeSpec = item.sizeSpec().trim();
            int onHand = Math.max(0, item.onHandQty());
            int committed = item.committedQty() != null ? Math.max(0, item.committedQty()) : 0;

            ProductSku sku = productSkuRepository
                    .findByProductIdAndFinishIdAndSizeSpec(product.getId(), finishId, sizeSpec)
                    .orElseGet(() -> {
                        ProductSku created = new ProductSku();
                        created.setProduct(product);
                        created.setFinishId(finishId);
                        created.setSizeSpec(sizeSpec);
                        created.setReservedQty(0);
                        return created;
                    });

            int reserved = sku.getReservedQty() != null ? sku.getReservedQty() : 0;
            if (onHand < reserved + committed) {
                throw new IllegalArgumentException(
                        "SKU (" + product.getId() + "/" + finishId + "/" + sizeSpec
                                + ") 实有库存(" + onHand + ") 不能小于当前预占(" + reserved + ") + 已承诺(" + committed + ")。");
            }
            sku.setOnHandQty(onHand);
            sku.setCommittedQty(committed);
            if (item.supplierName() != null) {
                sku.setSupplierName(item.supplierName().trim().isEmpty() ? null : item.supplierName().trim());
            }
            if (item.restockEta() != null) {
                sku.setRestockEta(item.restockEta());
            }
            if (item.unitCost() != null) {
                sku.setUnitCost(item.unitCost());
            }
            int availableAfter = Math.max(0, onHand - reserved - committed);
            sku.setSalesStatus(normalizeSalesStatus(item.salesStatus(), availableAfter));
            sku.setStocktakeVerified(true);
            sku.setStocktakeAt(now);
            sku.setStocktakeBy(verifier);

            ProductSku saved = productSkuRepository.save(sku);
            imported.add(toAdminSkuDTO(saved));
            affectedProductIds.add(product.getId());
        }

        for (Long productId : affectedProductIds) {
            syncAggregateProductStock(productId);
        }
        evictCatalogCache();
        return imported;
    }

    private ProductSkuDTO upsertSkuInternal(
            Long productId,
            ProductSkuUpsertDTO request,
            Integer committedQtyOverride,
            String operatorEmail,
            boolean markStocktake) {
        if (productSkuRepository == null) {
            throw new IllegalStateException("SKU repository is not configured.");
        }
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        String finishId = request.finishId().trim();
        String sizeSpec = request.sizeSpec().trim();
        int onHand = request.onHandQty() != null ? Math.max(0, request.onHandQty()) : 0;

        ProductSku sku = productSkuRepository
                .findByProductIdAndFinishIdAndSizeSpec(productId, finishId, sizeSpec)
                .orElseGet(() -> {
                    ProductSku created = new ProductSku();
                    created.setProduct(product);
                    created.setFinishId(finishId);
                    created.setSizeSpec(sizeSpec);
                    created.setReservedQty(0);
                    created.setCommittedQty(0);
                    return created;
                });

        int reserved = sku.getReservedQty() != null ? sku.getReservedQty() : 0;
        int committed = committedQtyOverride != null
                ? Math.max(0, committedQtyOverride)
                : (sku.getCommittedQty() != null ? sku.getCommittedQty() : 0);

        sku.setOnHandQty(onHand);
        sku.setCommittedQty(committed);
        sku.setSupplierName(request.supplierName() != null && !request.supplierName().isBlank()
                ? request.supplierName().trim() : null);
        sku.setRestockEta(request.restockEta());
        sku.setUnitCost(request.unitCost());
        int availableAfter = Math.max(0, onHand - reserved - committed);
        sku.setSalesStatus(normalizeSalesStatus(request.salesStatus(), availableAfter));
        if (markStocktake) {
            sku.setStocktakeVerified(true);
            sku.setStocktakeAt(BusinessClock.now());
            sku.setStocktakeBy(operatorEmail != null ? operatorEmail : "warehouse");
        }

        ProductSku saved = productSkuRepository.save(sku);
        syncAggregateProductStock(productId);
        return toAdminSkuDTO(saved);
    }

    private void syncAggregateProductStock(Long productId) {
        if (productSkuRepository == null || productId == null) return;
        Product product = productRepository.findById(productId).orElse(null);
        if (product == null) return;
        List<ProductSku> allSkus = productSkuRepository.findByProductIdOrderByIdAsc(productId);
        int aggregateAvailable = allSkus.stream()
                .filter(s -> ProductSalesStatus.AVAILABLE.equalsIgnoreCase(s.getSalesStatus()))
                .mapToInt(ProductSku::getAvailableQty)
                .sum();
        product.setStockQuantity(aggregateAvailable);
        productRepository.save(product);
    }

    private void evictCatalogCache() {
        if (cacheManager == null) return;
        Cache cache = cacheManager.getCache("productCatalog");
        if (cache != null) cache.clear();
    }

    private List<ProductResponseDTO> mapProductsWithSkus(List<Product> products, boolean publicView) {
        Map<Long, List<ProductSku>> skuMap = loadSkuEntityMap(products);
        return products.stream()
                .map(p -> toResponseDTO(p, skuMap.getOrDefault(p.getId(), List.of()), publicView))
                .toList();
    }

    private Map<Long, List<ProductSku>> loadSkuEntityMap(List<Product> products) {
        if (productSkuRepository == null || products.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = products.stream().map(Product::getId).filter(java.util.Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        List<ProductSku> rows = productSkuRepository.findByProductIdInOrderByIdAsc(ids);
        if (rows == null || rows.isEmpty()) {
            return Map.of();
        }
        return rows.stream().collect(Collectors.groupingBy(s -> s.getProduct().getId()));
    }

    private List<ProductSku> loadSkuEntitiesForProduct(Long productId) {
        if (productSkuRepository == null || productId == null) {
            return List.of();
        }
        List<ProductSku> rows = productSkuRepository.findByProductIdOrderByIdAsc(productId);
        return rows != null ? rows : List.of();
    }

    private ProductSkuDTO toAdminSkuDTO(ProductSku s) {
        int avail = s.getAvailableQty();
        String status = s.getSalesStatus() != null ? s.getSalesStatus() : ProductSalesStatus.PAUSED;
        boolean inStock = ProductSalesStatus.AVAILABLE.equalsIgnoreCase(status) && avail > 0;
        return new ProductSkuDTO(
                s.getId(),
                s.getProduct() != null ? s.getProduct().getId() : null,
                s.getFinishId(),
                s.getSizeSpec(),
                s.getSupplierName(),
                s.getOnHandQty() != null ? s.getOnHandQty() : 0,
                s.getReservedQty() != null ? s.getReservedQty() : 0,
                s.getCommittedQty() != null ? s.getCommittedQty() : 0,
                avail,
                status,
                s.getRestockEta(),
                s.getUnitCost(),
                inStock,
                inStock && avail <= 5,
                s.isStocktakeVerified(),
                s.getStocktakeAt(),
                s.getStocktakeBy()
        );
    }

    private ProductSkuDTO toPublicSkuDTO(ProductSku s) {
        int avail = s.getAvailableQty();
        String rawStatus = s.getSalesStatus() != null ? s.getSalesStatus() : ProductSalesStatus.PAUSED;
        boolean inStock = ProductSalesStatus.AVAILABLE.equalsIgnoreCase(rawStatus) && avail > 0;
        String effectiveStatus = ProductSalesStatus.AVAILABLE.equalsIgnoreCase(rawStatus) && avail <= 0
                ? ProductSalesStatus.OUT_OF_STOCK
                : rawStatus;
        return ProductSkuDTO.publicProjection(
                s.getId(),
                s.getProduct() != null ? s.getProduct().getId() : null,
                s.getFinishId(),
                s.getSizeSpec(),
                effectiveStatus,
                s.getRestockEta(),
                inStock,
                inStock && avail <= 5
        );
    }

    private static int safeCompare(BigDecimal a, BigDecimal b) {
        if (a == null && b == null) return 0;
        if (a == null) return -1;
        if (b == null) return 1;
        return a.compareTo(b);
    }

    private ProductResponseDTO toResponseDTO(Product product, List<ProductSku> skuEntities, boolean publicView) {
        int effectiveStock = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
        if (skuEntities != null && !skuEntities.isEmpty()) {
            effectiveStock = skuEntities.stream()
                    .filter(s -> ProductSalesStatus.AVAILABLE.equalsIgnoreCase(s.getSalesStatus()))
                    .mapToInt(ProductSku::getAvailableQty)
                    .sum();
        }
        String productStatus = product.getSalesStatus() != null ? product.getSalesStatus() : ProductSalesStatus.AVAILABLE;
        boolean inStock = ProductSalesStatus.AVAILABLE.equalsIgnoreCase(productStatus) && effectiveStock > 0;
        boolean lowStock = inStock && effectiveStock <= 5;
        List<ProductSkuDTO> skuDtos = skuEntities == null
                ? List.of()
                : skuEntities.stream()
                        .map(publicView ? this::toPublicSkuDTO : this::toAdminSkuDTO)
                        .toList();

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
                                ar.getModelScaleMode(),
                                ar.getLegacyMaterials(),
                                new ProductArConfigDTO.TransformOffsetDTO(
                                        List.of(ar.getPositionX(), ar.getPositionY(), ar.getPositionZ()),
                                        List.of(ar.getRotationX(), ar.getRotationY(), ar.getRotationZ()),
                                        ar.getScale()
                                )
                        ))
                        .toList(),
                // P0-10: Do NOT expose exact warehouse stock counts in public responses
                publicView ? null : effectiveStock,
                productStatus,
                skuDtos,
                inStock,
                lowStock
        );
    }

    @org.springframework.transaction.annotation.Transactional
    @CacheEvict(value = "productCatalog", allEntries = true)
    public ProductResponseDTO createProduct(ProductRequestDTO request) {
        int stock = request.stockQuantity() != null ? Math.max(0, request.stockQuantity()) : 50;
        String status = normalizeSalesStatus(request.salesStatus(), stock);
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
                .stockQuantity(stock)
                .salesStatus(status)
                .build();
        Product saved = productRepository.save(product);
        return toResponseDTO(saved, loadSkuEntitiesForProduct(saved.getId()), false);
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
        if (request.stockQuantity() != null) {
            product.setStockQuantity(Math.max(0, request.stockQuantity()));
        }
        if (request.salesStatus() != null && !request.salesStatus().isBlank()) {
            product.setSalesStatus(normalizeSalesStatus(request.salesStatus(), product.getStockQuantity()));
        }
        product.setName(request.nameEn().trim());
        product.setMaterial(request.materialEn().trim());

        Product saved = productRepository.save(product);
        return toResponseDTO(saved, loadSkuEntitiesForProduct(saved.getId()), false);
    }

    private String normalizeSalesStatus(String rawStatus, Integer stockQuantity) {
        if (rawStatus == null || rawStatus.isBlank()) {
            return (stockQuantity != null && stockQuantity <= 0)
                    ? ProductSalesStatus.OUT_OF_STOCK
                    : ProductSalesStatus.AVAILABLE;
        }
        String normalized = rawStatus.trim().toUpperCase();
        if (!ProductSalesStatus.isValid(normalized)) {
            throw new IllegalArgumentException("Invalid product sales status: " + rawStatus);
        }
        return normalized;
    }

    @org.springframework.transaction.annotation.Transactional
    @CacheEvict(value = "productCatalog", allEntries = true)
    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));
        try {
            productRepository.delete(product);
            productRepository.flush();
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            product.setSalesStatus(ProductSalesStatus.ARCHIVED);
            productRepository.save(product);
        }
    }
}
