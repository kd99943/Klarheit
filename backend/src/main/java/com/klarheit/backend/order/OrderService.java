package com.klarheit.backend.order;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.lens.LensOption;
import com.klarheit.backend.lens.LensOptionRepository;
import com.klarheit.backend.order.dto.OrderRequestDTO;
import com.klarheit.backend.order.dto.OrderResponseDTO;
import com.klarheit.backend.prescription.Prescription;
import com.klarheit.backend.prescription.PrescriptionRepository;
import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductRepository;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Service;

@Service
public class OrderService {

    private static final DateTimeFormatter ORDER_NUMBER_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final ProductRepository productRepository;
    private final LensOptionRepository lensOptionRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final OrderRepository orderRepository;
    private final UserAccountRepository userAccountRepository;

    public OrderService(
            ProductRepository productRepository,
            LensOptionRepository lensOptionRepository,
            PrescriptionRepository prescriptionRepository,
            OrderRepository orderRepository,
            UserAccountRepository userAccountRepository) {
        this.productRepository = productRepository;
        this.lensOptionRepository = lensOptionRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.orderRepository = orderRepository;
        this.userAccountRepository = userAccountRepository;
    }

    @Transactional
    public OrderResponseDTO checkout(OrderRequestDTO request, String authenticatedEmail) {
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new IllegalArgumentException("Selected product does not exist."));
        UserAccount userAccount = userAccountRepository.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));

        if (!userAccount.getEmail().equalsIgnoreCase(request.customer().email())) {
            throw new IllegalArgumentException("Checkout email must match the authenticated account.");
        }

        List<String> normalizedLensOptionTypes = normalizeLensTypes(request.lensOptionTypes());
        List<LensOption> lensOptions = lensOptionRepository.findByTypeIn(normalizedLensOptionTypes);
        if (lensOptions.size() != normalizedLensOptionTypes.size()) {
            throw new IllegalArgumentException("One or more selected lens options are invalid.");
        }

        prescriptionRepository.save(Prescription.builder()
                .userEmail(userAccount.getEmail())
                .sphOd(request.prescription().sphOd())
                .sphOs(request.prescription().sphOs())
                .cylOd(request.prescription().cylOd())
                .cylOs(request.prescription().cylOs())
                .axisOd(request.prescription().axisOd())
                .axisOs(request.prescription().axisOs())
                .pd(request.prescription().pd())
                .user(userAccount)
                .build());

        BigDecimal lensTotal = lensOptions.stream()
                .map(LensOption::getAdditionalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalAmount = product.getBasePrice().add(lensTotal);

        Order order = orderRepository.save(Order.builder()
                .orderNumber(generateOrderNumber())
                .totalAmount(totalAmount)
                .status("CREATED")
                .user(userAccount)
                .build());

        return new OrderResponseDTO(
                order.getOrderNumber(),
                order.getStatus(),
                order.getTotalAmount(),
                product.getName(),
                normalizedLensOptionTypes);
    }

    private List<String> normalizeLensTypes(List<String> lensOptionTypes) {
        Set<String> normalized = new LinkedHashSet<>();
        for (String lensOptionType : lensOptionTypes) {
            String value = lensOptionType == null ? "" : lensOptionType.trim().toUpperCase();
            if (value.isBlank()) {
                throw new IllegalArgumentException("Lens option type cannot be blank.");
            }
            if (!normalized.add(value)) {
                throw new IllegalArgumentException("Duplicate lens options are not allowed.");
            }
        }
        return List.copyOf(normalized);
    }

    private String generateOrderNumber() {
        return "KLR-" + LocalDateTime.now().format(ORDER_NUMBER_FORMAT)
                + "-" + ThreadLocalRandom.current().nextInt(1000, 10000);
    }
}
