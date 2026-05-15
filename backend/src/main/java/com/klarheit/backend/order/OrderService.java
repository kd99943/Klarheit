package com.klarheit.backend.order;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.email.EmailService;
import com.klarheit.backend.lens.LensOption;
import com.klarheit.backend.lens.LensOptionRepository;
import com.klarheit.backend.order.dto.OrderRequestDTO;
import com.klarheit.backend.order.dto.OrderResponseDTO;
import com.klarheit.backend.order.dto.OrderSummaryDTO;
import java.util.Arrays;
import com.klarheit.backend.prescription.Prescription;
import com.klarheit.backend.prescription.PrescriptionRepository;
import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class OrderService {
    private static final DateTimeFormatter ORDER_NUMBER_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final ProductRepository productRepository;
    private final LensOptionRepository lensOptionRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final OrderRepository orderRepository;
    private final UserAccountRepository userAccountRepository;
    private final EmailService emailService;

    public OrderService(ProductRepository productRepository, LensOptionRepository lensOptionRepository,
                        PrescriptionRepository prescriptionRepository, OrderRepository orderRepository,
                        UserAccountRepository userAccountRepository, EmailService emailService) {
        this.productRepository = productRepository;
        this.lensOptionRepository = lensOptionRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.orderRepository = orderRepository;
        this.userAccountRepository = userAccountRepository;
        this.emailService = emailService;
    }

    @Transactional
    public OrderResponseDTO checkout(OrderRequestDTO request, String authenticatedEmail) {
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new IllegalArgumentException("Selected product does not exist."));
        UserAccount user = userAccountRepository.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));

        if (!user.getEmail().equalsIgnoreCase(request.customer().email())) {
            throw new IllegalArgumentException("Checkout email must match the authenticated account.");
        }

        List<String> normalizedLensTypes = normalizeLensTypes(request.lensOptionTypes());
        List<LensOption> lensOptions = lensOptionRepository.findByTypeIn(normalizedLensTypes);
        if (lensOptions.size() != normalizedLensTypes.size()) {
            throw new IllegalArgumentException("One or more selected lens options are invalid.");
        }

        Prescription prescription = prescriptionRepository.save(Prescription.builder()
                .userEmail(user.getEmail())
                .sphOd(request.prescription().sphOd())
                .sphOs(request.prescription().sphOs())
                .cylOd(request.prescription().cylOd())
                .cylOs(request.prescription().cylOs())
                .axisOd(request.prescription().axisOd())
                .axisOs(request.prescription().axisOs())
                .pd(request.prescription().pd())
                .user(user)
                .build());

        BigDecimal lensTotal = lensOptions.stream()
                .map(LensOption::getAdditionalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalAmount = product.getBasePrice().add(lensTotal);

        Order order = orderRepository.save(Order.builder()
                .orderNumber(generateOrderNumber())
                .totalAmount(totalAmount)
                .status("CREATED")
                .user(user)
                .product(product)
                .prescription(prescription)
                .customerFirstName(request.customer().firstName().trim())
                .customerLastName(request.customer().lastName().trim())
                .customerEmail(user.getEmail())
                .shippingAddress(request.customer().shippingAddress().trim())
                .lensOptionTypes(String.join(",", normalizedLensTypes))
                .build());

        log.info("Order created: {} for user: {} amount: {}", order.getOrderNumber(), user.getEmail(), totalAmount);

        emailService.sendOrderConfirmation(
                user.getEmail(),
                order.getOrderNumber(),
                product.getName(),
                totalAmount.toPlainString());

        return new OrderResponseDTO(
                order.getOrderNumber(),
                order.getStatus(),
                order.getTotalAmount(),
                product.getName(),
                normalizedLensTypes);
    }

    @Transactional(readOnly = true)
    public List<OrderSummaryDTO> getMyOrders(String authenticatedEmail) {
        return orderRepository.findByUserEmailOrderByCreatedAtDesc(authenticatedEmail)
                .stream()
                .map(order -> new OrderSummaryDTO(
                        order.getOrderNumber(),
                        order.getStatus(),
                        order.getTotalAmount(),
                        order.getProduct().getName(),
                        Arrays.asList(order.getLensOptionTypes().split(",")),
                        order.getCreatedAt()
                ))
                .toList();
    }

    private List<String> normalizeLensTypes(List<String> lensOptionTypes) {
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String lensOptionType : lensOptionTypes) {
            String candidate = lensOptionType == null ? "" : lensOptionType.trim().toUpperCase();
            if (candidate.isBlank()) {
                throw new IllegalArgumentException("Lens option type cannot be blank.");
            }
            if (!normalized.add(candidate)) {
                throw new IllegalArgumentException("Duplicate lens options are not allowed.");
            }
        }
        return List.copyOf(normalized);
    }

    private String generateOrderNumber() {
        return "KL-" + LocalDateTime.now().format(ORDER_NUMBER_FORMAT) + "-"
                + ThreadLocalRandom.current().nextInt(1000, 10000);
    }
}
