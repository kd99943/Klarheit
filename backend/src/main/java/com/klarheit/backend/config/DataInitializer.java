package com.klarheit.backend.config;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderRepository;
import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductRepository;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Ensures catalog data is consistent at startup.
 *
 * <p>All seed data (products, lens options, AR configs) is now managed by
 * Flyway migrations (V8, V17, ...). This bean only performs defensive
 * housekeeping that Flyway cannot express declaratively:
 * <ul>
 *   <li>{@link #normalizeAndDeduplicateProducts} — folds together any
 *       duplicate product rows that may have been created before the unique
 *       constraint existed, re-pointing their orders to the canonical row.</li>
 * </ul>
 *
 * <p>AR configs are no longer upserted here — that behavior created a second
 * source of truth alongside Flyway and silently overwrote any manual
 * adjustments on every restart. Use a new Flyway migration to update seed
 * data going forward.</p>
 */
@Slf4j
@Configuration
public class DataInitializer {
    @Bean
    @Profile("local")
    ApplicationRunner seedCatalogData(ProductRepository productRepository, OrderRepository orderRepository) {
        return args -> normalizeAndDeduplicateProducts(productRepository, orderRepository);
    }

    /**
     * Re-creates the local-only dev admin account (admin@klarheit.com / admin)
     * so that V16 can safely delete the production-seeded default admin without
     * breaking local workflows.
     *
     * <p>Active only under the {@code local} profile. Production deployments use
     * the default {@code prod} profile and will not run this bean, leaving no
     * known-weak admin account in the database.</p>
     */
    @Bean
    @Profile("local")
    ApplicationRunner seedDevAdmin(UserAccountRepository userAccountRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userAccountRepository.existsByEmailIgnoreCase("admin@klarheit.com")) {
                return;
            }
            UserAccount admin = UserAccount.builder()
                    .email("admin@klarheit.com")
                    .passwordHash(passwordEncoder.encode("admin"))
                    .firstName("Admin")
                    .lastName("User")
                    .role("ADMIN")
                    .build();
            userAccountRepository.save(admin);
            log.info("Seeded dev-only admin account (admin@klarheit.com / admin) — local profile only");
        };
    }

    private void normalizeAndDeduplicateProducts(ProductRepository productRepository, OrderRepository orderRepository) {
        List<Product> allProducts = productRepository.findAll();
        List<String> canonicalNames = List.of("AERO X1", "MONOLITH 02", "ORBIT T-4", "LUCENT V1");

        for (String canonicalName : canonicalNames) {
            List<Product> matches = allProducts.stream()
                    .filter(p -> canonicalName.equalsIgnoreCase(p.getName()))
                    .toList();

            if (matches.size() > 1) {
                // Find or choose the one to keep (canonical one or the first one)
                Product canonicalProduct = matches.stream()
                        .filter(p -> canonicalName.equals(p.getName()))
                        .findFirst()
                        .orElse(matches.get(0));

                // If the one we keep is not uppercase, rename it
                if (!canonicalName.equals(canonicalProduct.getName())) {
                    canonicalProduct.setName(canonicalName);
                    productRepository.save(canonicalProduct);
                }

                // Delete others after moving orders
                for (Product duplicate : matches) {
                    if (duplicate.getId().equals(canonicalProduct.getId())) {
                        continue;
                    }

                    // Move orders
                    List<Order> orders = orderRepository.findAll().stream()
                            .filter(o -> o.getProduct() != null && o.getProduct().getId().equals(duplicate.getId()))
                            .toList();

                    for (Order order : orders) {
                        order.setProduct(canonicalProduct);
                        orderRepository.save(order);
                    }

                    // Delete duplicate
                    productRepository.delete(duplicate);
                }
            } else if (matches.size() == 1) {
                // Just rename to uppercase if needed
                Product product = matches.get(0);
                if (!canonicalName.equals(product.getName())) {
                    product.setName(canonicalName);
                    productRepository.save(product);
                }
            }
        }
    }
}
