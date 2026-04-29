package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.lens.LensOption;
import com.klarheit.backend.lens.LensOptionRepository;
import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderRepository;
import com.klarheit.backend.prescription.Prescription;
import com.klarheit.backend.prescription.PrescriptionRepository;
import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductRepository;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
class RepositoryPersistenceTests {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private LensOptionRepository lensOptionRepository;

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Test
    void repositoriesPersistCoreEntities() {
        UserAccount user = userAccountRepository.save(UserAccount.builder()
                .email("client@example.com")
                .passwordHash("hash")
                .firstName("Ada")
                .lastName("Lovelace")
                .build());

        Product product = productRepository.save(Product.builder()
                .name("AERO X1")
                .material("Grade 5 Titanium")
                .basePrice(new BigDecimal("850.00"))
                .imageUrl("https://example.com/aero-x1.png")
                .build());

        LensOption lensOption = lensOptionRepository.save(LensOption.builder()
                .type("HIGH_INDEX")
                .indexValue(new BigDecimal("1.74"))
                .additionalPrice(new BigDecimal("215.00"))
                .build());

        Prescription prescription = prescriptionRepository.save(Prescription.builder()
                .userEmail("client@example.com")
                .sphOd(new BigDecimal("-2.25"))
                .sphOs(new BigDecimal("-2.00"))
                .cylOd(new BigDecimal("-0.50"))
                .cylOs(new BigDecimal("-0.25"))
                .axisOd(180)
                .axisOs(175)
                .pd(new BigDecimal("63.50"))
                .user(user)
                .build());

        Order order = orderRepository.save(Order.builder()
                .orderNumber("KL-20260424-0001")
                .totalAmount(new BigDecimal("1155.00"))
                .status("PENDING")
                .user(user)
                .build());

        assertThat(user.getId()).isNotNull();
        assertThat(product.getId()).isNotNull();
        assertThat(lensOption.getId()).isNotNull();
        assertThat(prescription.getId()).isNotNull();
        assertThat(order.getId()).isNotNull();
        assertThat(orderRepository.findByOrderNumber("KL-20260424-0001")).contains(order);
    }
}
