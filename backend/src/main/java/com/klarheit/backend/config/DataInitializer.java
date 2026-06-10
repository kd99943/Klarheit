package com.klarheit.backend.config;

import com.klarheit.backend.lens.LensOption;
import com.klarheit.backend.lens.LensOptionRepository;
import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductArConfig;
import com.klarheit.backend.product.ProductRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Ensures catalog data is present at startup.
 *
 * <p>Seed products, lens options, and AR configs are managed by Flyway
 * (V8__seed_catalog_data_and_fixes.sql).  This bean only fills in any
 * gaps that Flyway cannot express — primarily upserting AR config
 * rows whose fields may have changed since the last migration.</p>
 */
@Configuration
public class DataInitializer {
    @Bean
    ApplicationRunner seedCatalogData(ProductRepository productRepository, LensOptionRepository lensOptionRepository) {
        return args -> {
            seedProductArConfigs(productRepository);
        };
    }

    private void seedProductArConfigs(ProductRepository productRepository) {
        productRepository.findAll().stream()
                .filter(p -> "AERO X1".equals(p.getNameEn()))
                .findFirst()
                .ifPresent(product -> {
                    List<ProductArConfig> configs = product.getArConfigs();

                    updateOrCreateConfig(product, configs, "matte-black", "color.matteBlack", "Onyx AR", "Onyx AR", "黑玛瑙增透膜", "fit.urbanContrast", "#111827", "#5eead4", new BigDecimal("-0.0300"));
                    updateOrCreateConfig(product, configs, "titanium", "color.titanium", "Neutral Clear", "Neutral Clear", "自然高清无色", "fit.studioNeutral", "#94a3b8", "#dbeafe", new BigDecimal("-0.0300"));
                    updateOrCreateConfig(product, configs, "rose-gold", "color.roseGold", "Warm HEV", "Warm HEV", "暖色防蓝光", "fit.softDaylight", "#fb7185", "#fed7aa", new BigDecimal("-0.0300"));

                    productRepository.save(product);
                });
    }

    private void updateOrCreateConfig(Product product, List<ProductArConfig> configs, String finishId, String finishLabelKey, String lensLabel, String lensLabelEn, String lensLabelZh, String fitLabelKey, String frameColor, String lensColor, BigDecimal posY) {
        ProductArConfig config = configs.stream()
                .filter(c -> finishId.equals(c.getFinishId()))
                .findFirst()
                .orElse(null);

        if (config == null) {
            config = ProductArConfig.builder()
                    .product(product)
                    .finishId(finishId)
                    .build();
            configs.add(config);
        }

        config.setFinishLabelKey(finishLabelKey);
        config.setLensLabel(lensLabel);
        config.setLensLabelEn(lensLabelEn);
        config.setLensLabelZh(lensLabelZh);
        config.setFitLabelKey(fitLabelKey);
        config.setFrameColor(frameColor);
        config.setLensColor(lensColor);
        config.setModelUrl(null);
        config.setPositionX(BigDecimal.ZERO.setScale(4));
        config.setPositionY(posY);
        config.setPositionZ(BigDecimal.ZERO.setScale(4));
        config.setRotationX(BigDecimal.ZERO.setScale(4));
        config.setRotationY(BigDecimal.ZERO.setScale(4));
        config.setRotationZ(BigDecimal.ZERO.setScale(4));
        config.setScale(BigDecimal.ONE.setScale(4));
    }
}
