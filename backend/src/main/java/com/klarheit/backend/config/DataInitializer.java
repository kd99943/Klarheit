package com.klarheit.backend.config;

import com.klarheit.backend.lens.LensOption;
import com.klarheit.backend.lens.LensOptionRepository;
import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataInitializer {

    @Bean
    ApplicationRunner seedCatalogData(
            ProductRepository productRepository,
            LensOptionRepository lensOptionRepository) {
        return args -> {
            seedMissingProducts(productRepository);
            seedMissingLensOptions(lensOptionRepository);
        };
    }

    private void seedMissingProducts(ProductRepository productRepository) {
        Set<String> existingNames = productRepository.findAll().stream()
                .map(Product::getName)
                .collect(java.util.stream.Collectors.toSet());

        List<Product> missingProducts = List.of(
                Product.builder()
                        .name("AERO X1")
                        .material("Grade 5 Titanium")
                        .basePrice(new BigDecimal("850.00"))
                        .imageUrl("https://lh3.googleusercontent.com/aida-public/AB6AXuBb8Byc3U14OllQFzl-P3jW6do7clbwnX0iFlGhm-dgQ4lKhvqPzuoez03VjTXp8XoLHNudC1mK6t3jupMF90W-0wguyx7zkWM1RXS4NSNWBDT69eraS571YqMoHbAYZLV5gouVZzrb50-luJbqipELl8KUylM3Y0J289w735wXOzMTsOtOR-xNt3w0xgbRPYUSS225D5-tQX2cxaqqgBgKiwUtCD0wbbLj25rKtxfgdgfBVAkgfG5BikV3d1IRr8EM5yOe5nH_fg")
                        .build(),
                Product.builder()
                        .name("MONOLITH 02")
                        .material("Japanese Acetate")
                        .basePrice(new BigDecimal("620.00"))
                        .imageUrl("https://lh3.googleusercontent.com/aida-public/AB6AXuB-rn8ohBXhkK5Zwr0-gxrOU05kJfJE3RYrXhziYItbHh-hVYJxeuYF0D9xwbRBwD74S45HUVt2NGhC5g_jwe9EM9TaPK7UaPLhRXo2L7-Y053JJ9IDdIcrIWlRzUsFQA6ZudgG4zr9yf66v3EeLBUA6TRkxQuWsqPuV9qEMCLU8Pgxd8MA6APqpuKXNqTtKuJ_BlTBsPAz6u19E_TnRdn_JxWOhtmVg7ByXQ4pnjYqqdq1DPwIWumqWysNoX5VsLB5bOnF33qDsA")
                        .build(),
                Product.builder()
                        .name("ORBIT T-4")
                        .material("Surgical Steel / Titanium")
                        .basePrice(new BigDecimal("950.00"))
                        .imageUrl("https://lh3.googleusercontent.com/aida-public/AB6AXuCW9E0krcpnM7Ui5ztHe63T0dkMQCoyET_YKJb9pGJ1UYgUls9Oxjcs4QaCOi3JUBaM8qtRc23xVvjnfKI6R4cYc1tSbwmSs0N5xDtL_TbmgTnvvWoSO9ozhsVwmGkEMqhfmbIRZAQpqQAw4VhR09kInAtHUWj1lL6A8N9zwjsTdrA9n8TsdGaZhGY1dLSBTGem1XM9f3qZyKr9kUlf2fGkyzGULqWFPg0ByecOimLVcl6KVEYoGR2Nhh4hu9ewOAPw7EEy85VpsQ")
                        .build(),
                Product.builder()
                        .name("LUCENT V1")
                        .material("Crystal Acetate")
                        .basePrice(new BigDecimal("580.00"))
                        .imageUrl("https://lh3.googleusercontent.com/aida-public/AB6AXuBlqQjs3rJN8DXJPK2WuyscH3ggw4Lka1Yot4iySSJkzTvYGf1VmMUb8TGYYnCeVxtWQHARMzLbczD79b96c5L5oMpb7bjYTruEabxAKfetMqiILt9_RgTh0Fe0G-ZqNh7b9gy7fd7XI94GmMzDHgNkqlaO7oYZWTh8IDOnluhjt-xVKUsl28HT47DihnoQjlGLnCtss3qIY4kJlxhs20xbtZJPypOYuJ8eajMDgzrvhkfy-4V2g-FkPJWo16ggJoG7IgHiWwF0tA")
                        .build()).stream()
                .filter(product -> !existingNames.contains(product.getName()))
                .toList();

        if (!missingProducts.isEmpty()) {
            productRepository.saveAll(missingProducts);
        }
    }

    private void seedMissingLensOptions(LensOptionRepository lensOptionRepository) {
        Set<String> existingTypes = lensOptionRepository.findAll().stream()
                .map(LensOption::getType)
                .collect(java.util.stream.Collectors.toSet());

        List<LensOption> missingLensOptions = List.of(
                LensOption.builder()
                        .type("HIGH_INDEX_174")
                        .indexValue(new BigDecimal("1.74"))
                        .additionalPrice(new BigDecimal("215.00"))
                        .build(),
                LensOption.builder()
                        .type("AR_ONYX")
                        .indexValue(BigDecimal.ZERO.setScale(2))
                        .additionalPrice(new BigDecimal("60.00"))
                        .build(),
                LensOption.builder()
                        .type("HEV_BLUE")
                        .indexValue(BigDecimal.ZERO.setScale(2))
                        .additionalPrice(new BigDecimal("30.00"))
                        .build()).stream()
                .filter(option -> !existingTypes.contains(option.getType()))
                .toList();

        if (!missingLensOptions.isEmpty()) {
            lensOptionRepository.saveAll(missingLensOptions);
        }
    }
}
