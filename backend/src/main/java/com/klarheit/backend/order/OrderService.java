package com.klarheit.backend.order;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserService;
import com.klarheit.backend.coupon.CouponService;
import com.klarheit.backend.coupon.dto.CouponValidateRequestDTO;
import com.klarheit.backend.coupon.dto.CouponValidateResponseDTO;
import com.klarheit.backend.email.EmailService;
import com.klarheit.backend.lens.LensOption;
import com.klarheit.backend.lens.LensOptionRepository;
import com.klarheit.backend.order.dto.OrderRequestDTO;
import com.klarheit.backend.order.dto.OrderResponseDTO;
import com.klarheit.backend.order.dto.OrderSummaryDTO;
import com.klarheit.backend.payment.PaymentInitiateResult;
import com.klarheit.backend.payment.PaymentService;
import java.util.Arrays;
import com.klarheit.backend.prescription.Prescription;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
    private final UserService userService;
    private final EmailService emailService;
    private final CouponService couponService;
    private final PaymentService paymentService;

    public OrderService(ProductRepository productRepository, LensOptionRepository lensOptionRepository,
                        PrescriptionRepository prescriptionRepository, OrderRepository orderRepository,
                        UserService userService, EmailService emailService,
                        CouponService couponService, PaymentService paymentService) {
        this.productRepository = productRepository;
        this.lensOptionRepository = lensOptionRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.orderRepository = orderRepository;
        this.userService = userService;
        this.emailService = emailService;
        this.couponService = couponService;
        this.paymentService = paymentService;
    }

    @Transactional
    public OrderResponseDTO checkout(OrderRequestDTO request, String authenticatedEmail) {
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new IllegalArgumentException("Selected product does not exist."));
        UserAccount user = userService.findByEmailIgnoreCase(authenticatedEmail)
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
                .sphOd(request.prescription().sphOd())
                .sphOs(request.prescription().sphOs())
                .cylOd(request.prescription().cylOd())
                .cylOs(request.prescription().cylOs())
                .axisOd(request.prescription().axisOd())
                .axisOs(request.prescription().axisOs())
                .pd(request.prescription().pd())
                .userId(user.getId())
                .build());

        BigDecimal lensTotal = lensOptions.stream()
                .map(LensOption::getAdditionalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalAmount = product.getBasePrice().add(lensTotal);

        BigDecimal discountAmount = BigDecimal.ZERO;
        String appliedCouponCode = null;
        if (request.couponCode() != null && !request.couponCode().isBlank()) {
            CouponValidateResponseDTO couponResp = couponService.validateCoupon(
                    new CouponValidateRequestDTO(request.couponCode(), totalAmount));
            discountAmount = couponResp.discountAmount();
            appliedCouponCode = couponResp.code();
        }

        BigDecimal finalTotalAmount = totalAmount.subtract(discountAmount);
        if (finalTotalAmount.compareTo(BigDecimal.ZERO) < 0) {
            finalTotalAmount = BigDecimal.ZERO;
        }

        String orderStatus = "CREATED";
        if (request.paymentChannel() != null && !request.paymentChannel().isBlank()) {
            orderStatus = "PENDING_PAYMENT";
        }

        Order order = orderRepository.save(Order.builder()
                .orderNumber(generateOrderNumber())
                .totalAmount(finalTotalAmount)
                .status(orderStatus)
                .userId(user.getId())
                .product(product)
                .prescription(prescription)
                .customerFirstName(request.customer().firstName().trim())
                .customerLastName(request.customer().lastName().trim())
                .customerEmail(user.getEmail())
                .shippingAddress(request.customer().shippingAddress().trim())
                .lensOptions(lensOptions)
                .paymentChannel(request.paymentChannel())
                .discountAmount(discountAmount)
                .appliedCouponCode(appliedCouponCode)
                .finishId(request.finishId())
                .build());

        log.info("Order created: {} for user: {} original amount: {}, discount: {}, final amount: {}",
                order.getOrderNumber(), user.getEmail(), totalAmount, discountAmount, finalTotalAmount);

        if (appliedCouponCode != null) {
            couponService.incrementCouponUsage(appliedCouponCode);
        }

        String payData = null;
        if ("PENDING_PAYMENT".equals(orderStatus)) {
            PaymentInitiateResult payResult = paymentService.initiatePayment(
                    order.getOrderNumber(), finalTotalAmount, request.paymentChannel());
            payData = payResult.payData();
            order.setGatewayTransactionId(payResult.transactionId());
            orderRepository.save(order);
        } else {
            emailService.sendOrderConfirmation(
                    user.getEmail(),
                    order.getOrderNumber(),
                    product.getName(),
                    finalTotalAmount.toPlainString());
        }

        return new OrderResponseDTO(
                order.getOrderNumber(),
                order.getStatus(),
                order.getTotalAmount(),
                product.getName(),
                normalizedLensTypes,
                payData,
                order.getFinishId());
    }

    @Transactional
    public void completePayment(String orderNumber, String gatewayTransactionId, String paymentChannel) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if ("PAID".equals(order.getStatus())) {
            log.info("Order {} is already paid. Ignoring duplicate webhook callback.", orderNumber);
            return;
        }

        order.setStatus("PAID");
        order.setGatewayTransactionId(gatewayTransactionId);
        order.setPaidAt(LocalDateTime.now());
        if (order.getPaymentChannel() == null) {
            order.setPaymentChannel(paymentChannel);
        }
        orderRepository.save(order);

        log.info("Order {} successfully paid via channel: {} with txId: {}", orderNumber, paymentChannel, gatewayTransactionId);

        try {
            emailService.sendOrderConfirmation(
                    order.getCustomerEmail(),
                    order.getOrderNumber(),
                    order.getProduct().getName(),
                    order.getTotalAmount().toPlainString());
        } catch (Exception e) {
            log.error("Failed to send order confirmation email for order: {}", orderNumber, e);
        }
    }

    @Transactional(readOnly = true)
    public List<OrderSummaryDTO> getMyOrders(String authenticatedEmail) {
        UserAccount user = userService.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(order -> new OrderSummaryDTO(
                        order.getOrderNumber(),
                        order.getStatus(),
                        order.getTotalAmount(),
                        order.getProduct().getName(),
                        order.getLensOptionTypes(),
                        order.getCreatedAt()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<OrderSummaryDTO> getMyOrdersPaged(String authenticatedEmail, Pageable pageable) {
        UserAccount user = userService.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), pageable)
                .map(order -> new OrderSummaryDTO(
                        order.getOrderNumber(),
                        order.getStatus(),
                        order.getTotalAmount(),
                        order.getProduct().getName(),
                        order.getLensOptionTypes(),
                        order.getCreatedAt()
                ));
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

    @Transactional(readOnly = true)
    public String getOrderStatusOnly(String orderNumber) {
        return orderRepository.findByOrderNumber(orderNumber)
                .map(Order::getStatus)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));
    }
}
