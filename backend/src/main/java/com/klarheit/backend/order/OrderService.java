package com.klarheit.backend.order;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserService;
import com.klarheit.backend.coupon.CouponService;
import com.klarheit.backend.coupon.dto.CouponValidateRequestDTO;
import com.klarheit.backend.coupon.dto.CouponValidateResponseDTO;
import com.klarheit.backend.email.EmailService;
import com.klarheit.backend.lens.LensOption;
import com.klarheit.backend.lens.LensOptionRepository;
import com.klarheit.backend.order.dto.CustomerInfoDTO;
import com.klarheit.backend.order.dto.OrderDetailResponseDTO;
import com.klarheit.backend.order.dto.OrderRequestDTO;
import com.klarheit.backend.order.dto.OrderResponseDTO;
import com.klarheit.backend.order.dto.OrderSummaryDTO;
import com.klarheit.backend.order.dto.PrescriptionDetailsDTO;
import com.klarheit.backend.payment.PaymentInitiateResult;
import com.klarheit.backend.payment.PaymentQueryResult;
import com.klarheit.backend.payment.PaymentQueryStatus;
import com.klarheit.backend.payment.PaymentService;
import com.klarheit.backend.payment.RefundResult;
import com.klarheit.backend.payment.RefundStatus;
import com.klarheit.backend.payment.RefundTransaction;
import com.klarheit.backend.payment.RefundTransactionRepository;
import com.klarheit.backend.prescription.Prescription;
import com.klarheit.backend.prescription.PrescriptionRepository;
import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductRepository;
import com.klarheit.backend.product.ProductSalesStatus;
import com.klarheit.backend.product.ProductSku;
import com.klarheit.backend.product.ProductSkuRepository;
import com.klarheit.backend.security.StaffRoles;
import com.klarheit.backend.settings.SystemSettingService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class OrderService {
    private static final DateTimeFormatter ORDER_NUMBER_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final int ORDER_NUMBER_MAX_RETRIES = 5;

    /** Default inventory hold durations (P0-02). */
    public static final long DEFAULT_REVIEW_HOLD_HOURS = 48L;
    public static final long DEFAULT_QUOTE_HOLD_HOURS = 72L;
    public static final long DEFAULT_PAYMENT_HOLD_MINUTES = 30L;

    /** Strict fulfillment stage transition matrix (P0-04). */
    private static final Map<String, Set<String>> ALLOWED_FULFILLMENT_TRANSITIONS = Map.of(
            FulfillmentStatus.PENDING_REVIEW, Set.of(
                    FulfillmentStatus.PENDING_REVIEW,
                    FulfillmentStatus.NEEDS_INFO,
                    FulfillmentStatus.IN_PRODUCTION,
                    FulfillmentStatus.EXCEPTION),
            FulfillmentStatus.NEEDS_INFO, Set.of(
                    FulfillmentStatus.NEEDS_INFO,
                    FulfillmentStatus.PENDING_REVIEW,
                    FulfillmentStatus.IN_PRODUCTION,
                    FulfillmentStatus.EXCEPTION),
            FulfillmentStatus.IN_PRODUCTION, Set.of(
                    FulfillmentStatus.IN_PRODUCTION,
                    FulfillmentStatus.QC_PASSED,
                    FulfillmentStatus.NEEDS_INFO,
                    FulfillmentStatus.EXCEPTION),
            FulfillmentStatus.QC_PASSED, Set.of(
                    FulfillmentStatus.QC_PASSED,
                    FulfillmentStatus.IN_PRODUCTION,
                    FulfillmentStatus.EXCEPTION),
            FulfillmentStatus.EXCEPTION, Set.of(
                    FulfillmentStatus.EXCEPTION,
                    FulfillmentStatus.PENDING_REVIEW,
                    FulfillmentStatus.NEEDS_INFO,
                    FulfillmentStatus.IN_PRODUCTION),
            FulfillmentStatus.SHIPPED, Set.of(FulfillmentStatus.SHIPPED),
            FulfillmentStatus.DELIVERED, Set.of(FulfillmentStatus.DELIVERED)
    );

    private final ProductRepository productRepository;
    private final LensOptionRepository lensOptionRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final OrderRepository orderRepository;
    private final UserService userService;
    private final EmailService emailService;
    private final CouponService couponService;
    private final PaymentService paymentService;

    @Autowired(required = false)
    private SystemSettingService systemSettingService;

    @Autowired(required = false)
    private ProductSkuRepository productSkuRepository;

    @Autowired(required = false)
    private OrderQuoteVersionRepository orderQuoteVersionRepository;

    @Autowired(required = false)
    private OrderShipmentEventRepository orderShipmentEventRepository;

    @Autowired(required = false)
    private RefundTransactionRepository refundTransactionRepository;

    @Autowired(required = false)
    private DeliveryPolicyService deliveryPolicyService;

    @Autowired(required = false)
    private CacheManager cacheManager;

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

    public void setSystemSettingService(SystemSettingService systemSettingService) {
        this.systemSettingService = systemSettingService;
    }

    public void setProductSkuRepository(ProductSkuRepository productSkuRepository) {
        this.productSkuRepository = productSkuRepository;
    }

    public void setOrderQuoteVersionRepository(OrderQuoteVersionRepository orderQuoteVersionRepository) {
        this.orderQuoteVersionRepository = orderQuoteVersionRepository;
    }

    public void setOrderShipmentEventRepository(OrderShipmentEventRepository orderShipmentEventRepository) {
        this.orderShipmentEventRepository = orderShipmentEventRepository;
    }

    public void setRefundTransactionRepository(RefundTransactionRepository refundTransactionRepository) {
        this.refundTransactionRepository = refundTransactionRepository;
    }

    public void setDeliveryPolicyService(DeliveryPolicyService deliveryPolicyService) {
        this.deliveryPolicyService = deliveryPolicyService;
    }

    @Transactional(readOnly = true)
    public DeliveryPolicyService.DeliveryEstimate estimateDelivery(CustomerInfoDTO customer, String fallbackPhone) {
        if (deliveryPolicyService == null) {
            return new DeliveryPolicyService.DeliveryEstimate(
                    true, false, BigDecimal.ZERO, 10, 14,
                    BusinessClock.today().plusDays(14),
                    customer != null ? customer.province() : null,
                    customer != null ? customer.city() : null,
                    "标准配送"
            );
        }
        return deliveryPolicyService.evaluate(customer, fallbackPhone);
    }

    @Transactional
    public OrderResponseDTO checkout(OrderRequestDTO request, String authenticatedEmail) {
        if (systemSettingService != null && !systemSettingService.isCheckoutEnabled()) {
            String reason = systemSettingService.getCheckoutPauseReason();
            String msg = (reason != null && !reason.isBlank())
                    ? "当前暂时停止接收新订单：" + reason
                    : "系统维护中，当前暂时停止接收新订单，已下单用户仍可查询订单与申请售后。";
            throw new IllegalStateException(msg);
        }

        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new IllegalArgumentException("Selected product does not exist."));
        UserAccount user = userService.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));

        // Idempotency check: prevent duplicate orders on retries / double-clicks / lost responses
        String idempotencyKey = request.idempotencyKey() != null && !request.idempotencyKey().isBlank()
                ? request.idempotencyKey().trim()
                : null;
        if (idempotencyKey != null) {
            Optional<Order> existing = orderRepository.findByUserIdAndIdempotencyKey(user.getId(), idempotencyKey);
            if (existing.isPresent()) {
                return buildIdempotentReplayResponse(existing.get(), user.getEmail(), idempotencyKey);
            }
        }

        if (!user.getEmail().equalsIgnoreCase(request.customer().email())) {
            throw new IllegalArgumentException("Checkout email must match the authenticated account.");
        }

        // Validate product sales availability
        String salesStatus = product.getSalesStatus() != null ? product.getSalesStatus() : ProductSalesStatus.AVAILABLE;
        if (!ProductSalesStatus.AVAILABLE.equalsIgnoreCase(salesStatus)) {
            throw new IllegalStateException("该镜框当前暂不可售（" + salesStatus + "），请返回目录选择其他款式。");
        }

        // P0-05: Pre-payment delivery region, address completeness, shipping fee & honest timeline check
        DeliveryPolicyService.DeliveryEstimate deliveryEstimate = null;
        if (deliveryPolicyService != null) {
            deliveryEstimate = deliveryPolicyService.evaluate(request.customer(), user.getPhone());
            if (!deliveryEstimate.deliverable()) {
                throw new IllegalArgumentException(deliveryEstimate.reason());
            }
        }

        // P0-01: Strict exact SKU resolution — NEVER silently fall back to another color or size
        ProductSku matchedSku = resolveSkuForCheckout(product, request.skuId(), request.finishId(), request.sizeSpec());
        if (matchedSku != null) {
            String skuStatus = matchedSku.getSalesStatus() != null ? matchedSku.getSalesStatus() : ProductSalesStatus.PAUSED;
            if (!ProductSalesStatus.AVAILABLE.equalsIgnoreCase(skuStatus) || matchedSku.getAvailableQty() <= 0) {
                String etaHint = matchedSku.getRestockEta() != null
                        ? "（预计补货日期：" + matchedSku.getRestockEta() + "）"
                        : "";
                throw new IllegalStateException("所选色款/尺码当前暂时缺货或不可售" + etaHint + "，请更换其他色款或款式。");
            }
        } else if (product.getStockQuantity() != null && product.getStockQuantity() <= 0) {
            throw new IllegalStateException("该镜框当前缺货，请返回目录选择其他款式。");
        }

        List<String> normalizedLensTypes = normalizeLensTypes(request.lensOptionTypes());
        List<LensOption> lensOptions = lensOptionRepository.findByTypeIn(normalizedLensTypes);

        Map<String, LensOption> uniqueLensOptions = new LinkedHashMap<>();
        for (LensOption option : lensOptions) {
            uniqueLensOptions.putIfAbsent(option.getType(), option);
        }

        if (uniqueLensOptions.size() != normalizedLensTypes.size()) {
            throw new IllegalArgumentException("One or more selected lens options are invalid.");
        }

        List<LensOption> deduplicatedLensOptions = new ArrayList<>(uniqueLensOptions.values());
        validateLensCombination(deduplicatedLensOptions);

        BigDecimal lensTotal = deduplicatedLensOptions.stream()
                .map(LensOption::getAdditionalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal merchandiseTotal = product.getBasePrice().add(lensTotal);
        BigDecimal shippingFee = (deliveryEstimate != null && deliveryEstimate.shippingFee() != null)
                ? deliveryEstimate.shippingFee()
                : BigDecimal.ZERO;

        BigDecimal discountAmount = BigDecimal.ZERO;
        String appliedCouponCode = null;
        if (request.couponCode() != null && !request.couponCode().isBlank()) {
            CouponValidateResponseDTO couponResp = couponService.validateCoupon(
                    new CouponValidateRequestDTO(request.couponCode(), merchandiseTotal));
            discountAmount = couponResp.discountAmount();
            appliedCouponCode = couponResp.code();
        }

        BigDecimal finalTotalAmount = merchandiseTotal.subtract(discountAmount).add(shippingFee);
        if (finalTotalAmount.compareTo(BigDecimal.ZERO) < 0) {
            finalTotalAmount = BigDecimal.ZERO;
        }

        // Pre-payment compatibility & delivery manual-review gate (P0-2 & P0-05)
        String rxReviewReason = evaluatePrepayReviewReason(request.prescription(), deduplicatedLensOptions);
        boolean deliveryNeedsManualReview = deliveryEstimate != null && deliveryEstimate.manualReviewRequired();
        String prepayReviewReason = combineReviewReasons(rxReviewReason,
                deliveryNeedsManualReview ? deliveryEstimate.reason() : null);
        boolean requiresPrepayReview = prepayReviewReason != null;

        String orderStatus = OrderStatus.CREATED;
        if (requiresPrepayReview) {
            orderStatus = OrderStatus.AWAITING_REVIEW;
        } else if (request.paymentChannel() != null && !request.paymentChannel().isBlank()) {
            if (finalTotalAmount.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalStateException("零元订单暂不支持线上支付网关结算，请联系客服协助确认。");
            }
            orderStatus = OrderStatus.PENDING_PAYMENT;
        }

        // Atomically reserve 1 unit of exact SKU (or legacy product) inventory
        if (matchedSku != null) {
            int reservedSku = productSkuRepository.reserveStockIfAvailable(matchedSku.getId());
            if (reservedSku == 0) {
                throw new IllegalStateException("所选色款刚刚售罄或已被抢占，请更换其他色款或款式。");
            }
            syncProductAggregateStock(product.getId());
        } else {
            int reserved = productRepository.decrementStockIfAvailable(product.getId());
            if (reserved == 0) {
                throw new IllegalStateException("该镜框刚刚售罄或已暂停销售，请更换其他款式。");
            }
            evictProductCatalogCache();
        }

        String wearerName = request.wearerName() != null && !request.wearerName().isBlank()
                ? request.wearerName().trim()
                : null;
        boolean saveToProfile = Boolean.TRUE.equals(request.savePrescriptionToProfile());

        Prescription prescription = prescriptionRepository.save(Prescription.builder()
                .sphOd(request.prescription().sphOd())
                .sphOs(request.prescription().sphOs())
                .cylOd(request.prescription().cylOd())
                .cylOs(request.prescription().cylOs())
                .axisOd(request.prescription().axisOd())
                .axisOs(request.prescription().axisOs())
                .pd(request.prescription().pd())
                .userId(user.getId())
                .savedToProfile(saveToProfile)
                .wearerName(wearerName)
                .sourceNote("订单录入")
                .build());

        String rawFirstName = request.customer().firstName() != null ? request.customer().firstName().trim() : "";
        String rawLastName = request.customer().lastName() != null ? request.customer().lastName().trim() : "";
        String rawPhone = request.customer().phone() != null && !request.customer().phone().isBlank()
                ? request.customer().phone().trim()
                : user.getPhone();

        // P0-01: Always snapshot canonical matched SKU finishId & sizeSpec (never stale/mismatched request values)
        String resolvedFinishId = matchedSku != null ? matchedSku.getFinishId() : request.finishId();
        String resolvedSizeSpec = matchedSku != null
                ? matchedSku.getSizeSpec()
                : (request.sizeSpec() != null && !request.sizeSpec().isBlank()
                        ? request.sizeSpec().trim()
                        : product.getSpecsSize());
        String resolvedOrderSource = request.orderSource() != null && !request.orderSource().isBlank()
                ? request.orderSource().trim().toUpperCase()
                : "DIRECT";
        String resolvedShippingAddress = deliveryPolicyService != null
                ? deliveryPolicyService.assembleAddress(request.customer())
                : request.customer().shippingAddress().trim();

        LocalDateTime now = BusinessClock.now();
        // P0-05: Only lock customer-facing promised date when order does not require pre-pay review
        LocalDate initialPromisedDate = requiresPrepayReview
                ? null
                : (deliveryEstimate != null && deliveryEstimate.estimatedDeliveryDate() != null
                        ? deliveryEstimate.estimatedDeliveryDate()
                        : BusinessClock.today().plusDays(14));
        String initialPromisedSource = requiresPrepayReview ? null : "CUSTOMER_CHECKOUT";
        LocalDateTime reviewExpiresAt = OrderStatus.AWAITING_REVIEW.equals(orderStatus)
                ? now.plusHours(DEFAULT_REVIEW_HOLD_HOURS)
                : null;

        Order order = null;
        for (int attempt = 0; attempt < ORDER_NUMBER_MAX_RETRIES; attempt++) {
            try {
                order = orderRepository.save(Order.builder()
                        .orderNumber(generateOrderNumber())
                        .totalAmount(finalTotalAmount)
                        .status(orderStatus)
                        .userId(user.getId())
                        .product(product)
                        .prescription(prescription)
                        .customerFirstName(rawFirstName)
                        .customerLastName(rawLastName)
                        .customerEmail(user.getEmail())
                        .customerPhone(rawPhone)
                        .shippingAddress(resolvedShippingAddress)
                        .shippingProvince(deliveryEstimate != null ? deliveryEstimate.resolvedProvince() : request.customer().province())
                        .shippingCity(deliveryEstimate != null && deliveryEstimate.resolvedCity() != null
                                ? deliveryEstimate.resolvedCity() : request.customer().city())
                        .shippingDistrict(request.customer().district())
                        .shippingDetailAddress(request.customer().detailAddress())
                        .shippingFee(shippingFee)
                        .deliveryReviewRequired(deliveryNeedsManualReview)
                        .lensOptions(deduplicatedLensOptions)
                        .paymentChannel(request.paymentChannel())
                        .discountAmount(discountAmount)
                        .appliedCouponCode(appliedCouponCode)
                        .finishId(resolvedFinishId)
                        .skuId(matchedSku != null ? matchedSku.getId() : null)
                        .sizeSpecSnapshot(resolvedSizeSpec)
                        .skuStockCommitted(false)
                        .idempotencyKey(idempotencyKey)
                        .wearerName(wearerName)
                        .fulfillmentStatus(FulfillmentStatus.PENDING_REVIEW)
                        .initialPromisedDeliveryDate(initialPromisedDate)
                        .initialPromisedSource(initialPromisedSource)
                        .estimatedDeliveryDate(initialPromisedDate)
                        .requiresPrepayReview(requiresPrepayReview)
                        .prepayReviewReason(prepayReviewReason)
                        .reviewExpiresAt(reviewExpiresAt)
                        .quoteVersion(0)
                        .prescriptionVersion(1)
                        .qcStatus("PENDING")
                        .orderSource(resolvedOrderSource)
                        .variableCostAmount(matchedSku != null ? matchedSku.getUnitCost() : null)
                        .confirmedRefundAmount(BigDecimal.ZERO)
                        .pendingRefundAmount(BigDecimal.ZERO)
                        .stockReleased(false)
                        .returnRestocked(false)
                        .productNameSnapshot(product.getName())
                        .productImageUrlSnapshot(product.getImageUrl())
                        .lensOptionsSnapshot(deduplicatedLensOptions.stream()
                                .map(option -> new OrderLensSnapshot(option.getType(), option.getLabel(), option.getAdditionalPrice()))
                                .toList())
                        .build());
                break;
            } catch (DataIntegrityViolationException e) {
                // Handle concurrent idempotency collision cleanly without double-creating
                if (idempotencyKey != null) {
                    Optional<Order> racedExisting = orderRepository.findByUserIdAndIdempotencyKey(user.getId(), idempotencyKey);
                    if (racedExisting.isPresent()) {
                        if (matchedSku != null) {
                            productSkuRepository.releaseReservedStock(matchedSku.getId());
                            syncProductAggregateStock(product.getId());
                        } else {
                            productRepository.incrementStock(product.getId());
                            evictProductCatalogCache();
                        }
                        return buildIdempotentReplayResponse(racedExisting.get(), user.getEmail(), idempotencyKey);
                    }
                }
                if (attempt == ORDER_NUMBER_MAX_RETRIES - 1) {
                    throw new IllegalStateException("Failed to generate a unique order number after " + ORDER_NUMBER_MAX_RETRIES + " attempts.", e);
                }
                log.warn("Order number collision on attempt {}, retrying...", attempt + 1);
            }
        }

        log.info("Order created: {} for user: {} skuId={} finish={} size={} original={}, shippingFee={}, discount={}, final={}",
                order.getOrderNumber(), user.getEmail(), order.getSkuId(), order.getFinishId(), order.getSizeSpecSnapshot(),
                merchandiseTotal, shippingFee, discountAmount, finalTotalAmount);

        if (appliedCouponCode != null) {
            couponService.incrementCouponUsage(appliedCouponCode);
        }

        String payData = null;
        if (OrderStatus.PENDING_PAYMENT.equals(orderStatus)) {
            PaymentInitiateResult payResult = paymentService.initiatePayment(
                    order.getOrderNumber(), finalTotalAmount, request.paymentChannel());
            payData = payResult.payData();
            order.setGatewayTransactionId(payResult.transactionId());
            orderRepository.save(order);
        } else if (!OrderStatus.AWAITING_REVIEW.equals(orderStatus)) {
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
                order.getFinishId(),
                order.getSkuId(),
                order.getSizeSpecSnapshot(),
                order.getQuoteVersion(),
                order.getShippingFee());
    }

    private OrderResponseDTO buildIdempotentReplayResponse(Order existingOrder, String email, String idempotencyKey) {
        log.info("Idempotent checkout hit for user {} key {} -> returning existing order {}",
                email, idempotencyKey, existingOrder.getOrderNumber());
        String replayPayData = null;
        if (OrderStatus.PENDING_PAYMENT.equalsIgnoreCase(existingOrder.getStatus())
                && existingOrder.getPaymentChannel() != null
                && !existingOrder.getPaymentChannel().isBlank()) {
            PaymentInitiateResult payResult = paymentService.initiatePayment(
                    existingOrder.getOrderNumber(), existingOrder.getTotalAmount(), existingOrder.getPaymentChannel());
            replayPayData = payResult.payData();
        }
        return new OrderResponseDTO(
                existingOrder.getOrderNumber(),
                existingOrder.getStatus(),
                existingOrder.getTotalAmount(),
                resolveProductName(existingOrder),
                existingOrder.getLensOptionTypes(),
                replayPayData,
                existingOrder.getFinishId(),
                existingOrder.getSkuId(),
                existingOrder.getSizeSpecSnapshot(),
                existingOrder.getQuoteVersion(),
                existingOrder.getShippingFee()
        );
    }

    private String combineReviewReasons(String rxReason, String deliveryReason) {
        if (rxReason != null && deliveryReason != null) {
            return rxReason + " " + deliveryReason;
        }
        return rxReason != null ? rxReason : deliveryReason;
    }

    /**
     * P0-01: Strict exact SKU lookup with ZERO silent fallback to another color or size.
     * Returns null ONLY when the product has no configured SKU inventory rows (legacy product-level mode).
     */
    private ProductSku resolveSkuForCheckout(Product product, Long requestedSkuId, String finishId, String requestedSizeSpec) {
        if (productSkuRepository == null || product == null || product.getId() == null) {
            return null;
        }
        String normalizedFinish = finishId != null && !finishId.isBlank() ? finishId.trim() : null;
        String explicitSize = requestedSizeSpec != null && !requestedSizeSpec.isBlank() ? requestedSizeSpec.trim() : null;

        // 1. Explicit skuId lookup — highest precision
        if (requestedSkuId != null) {
            ProductSku byId = productSkuRepository.findById(requestedSkuId)
                    .orElseThrow(() -> new IllegalStateException("所选商品规格不存在或已下架，请重新选择可用色款与尺码。"));
            if (byId.getProduct() == null || !product.getId().equals(byId.getProduct().getId())) {
                throw new IllegalStateException("所选规格与当前镜框款式不匹配，请重新选择。");
            }
            if (normalizedFinish != null && !normalizedFinish.equalsIgnoreCase(byId.getFinishId())) {
                throw new IllegalStateException("所选色款与规格标识不一致，请刷新页面后重新确认规格。");
            }
            if (explicitSize != null && !explicitSize.equalsIgnoreCase(byId.getSizeSpec())) {
                throw new IllegalStateException("所选尺码与规格标识不一致，请刷新页面后重新确认规格。");
            }
            return byId;
        }

        // 2. Exact (productId, finishId, sizeSpec) lookup
        String defaultProductSize = (product.getSpecsSize() != null && !product.getSpecsSize().isBlank())
                ? product.getSpecsSize().trim()
                : null;
        String candidateSize = explicitSize != null ? explicitSize : defaultProductSize;

        if (normalizedFinish != null && candidateSize != null) {
            Optional<ProductSku> exact = productSkuRepository
                    .findByProductIdAndFinishIdAndSizeSpec(product.getId(), normalizedFinish, candidateSize);
            if (exact.isPresent()) {
                return exact.get();
            }
        }

        // 3. Check whether this product has SKU rows configured at all
        List<ProductSku> productSkus = productSkuRepository.findByProductIdOrderByIdAsc(product.getId());
        if (productSkus == null || productSkus.isEmpty()) {
            return null; // Legacy product-level inventory mode
        }

        // Product HAS SKUs configured — enforce strict match (NO fallback to another color or size!)
        if (normalizedFinish == null) {
            if (productSkus.size() == 1) {
                ProductSku sole = productSkus.get(0);
                if (explicitSize != null && !explicitSize.equalsIgnoreCase(sole.getSizeSpec())) {
                    throw new IllegalStateException("所选尺码规格（" + explicitSize + "）不存在，请重新选择可用尺码。");
                }
                return sole;
            }
            throw new IllegalStateException("该款式包含多个色款/尺码规格，请明确选择具体色款与尺码后再下单。");
        }

        List<ProductSku> matchingFinishSkus = productSkus.stream()
                .filter(s -> normalizedFinish.equalsIgnoreCase(s.getFinishId()))
                .toList();

        if (matchingFinishSkus.isEmpty()) {
            throw new IllegalStateException("所选色款（" + normalizedFinish + "）不存在或已下架，请重新选择可用色款。");
        }
        if (explicitSize != null) {
            return matchingFinishSkus.stream()
                    .filter(s -> explicitSize.equalsIgnoreCase(s.getSizeSpec()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException(
                            "所选色款下无对应尺码（" + explicitSize + "），请明确选择可用尺码后再下单。"));
        }
        if (matchingFinishSkus.size() == 1) {
            return matchingFinishSkus.get(0);
        }
        throw new IllegalStateException("该色款包含多种尺码规格，请明确选择尺码后再下单。");
    }

    private String evaluatePrepayReviewReason(PrescriptionDetailsDTO rx, List<LensOption> lenses) {
        if (rx == null) {
            return null;
        }
        BigDecimal maxSph = maxAbs(rx.sphOd(), rx.sphOs());
        BigDecimal maxCyl = maxAbs(rx.cylOd(), rx.cylOs());

        if (maxSph.compareTo(new BigDecimal("8.00")) > 0 || maxCyl.compareTo(new BigDecimal("2.50")) > 0) {
            return "高度数或高散光处方（|SPH|>8.00 或 |CYL|>2.50），需验配师复核可加工方案、最终报价与交期后再付款。";
        }
        boolean hasStandard156 = lenses.stream().anyMatch(o -> "STANDARD_156".equalsIgnoreCase(o.getType()));
        if (hasStandard156 && maxSph.compareTo(new BigDecimal("4.00")) > 0) {
            return "球镜度数超过 ±4.00 且选择了 1.56 折射率镜片，边缘偏厚风险较高，需验配师确认镜片方案后再付款。";
        }
        boolean hasThin161 = lenses.stream().anyMatch(o -> "THIN_161".equalsIgnoreCase(o.getType()));
        if (hasThin161 && maxSph.compareTo(new BigDecimal("6.00")) > 0) {
            return "球镜度数超过 ±6.00 且选择了 1.61 折射率镜片，需验配师确认加工可行性与最终报价后再付款。";
        }
        return null;
    }

    private BigDecimal maxAbs(BigDecimal a, BigDecimal b) {
        BigDecimal absA = a != null ? a.abs() : BigDecimal.ZERO;
        BigDecimal absB = b != null ? b.abs() : BigDecimal.ZERO;
        return absA.compareTo(absB) >= 0 ? absA : absB;
    }

    @Transactional
    public OrderDetailResponseDTO adminConfirmPrepayQuote(
            String orderNumber,
            BigDecimal revisedTotalAmount,
            LocalDate promisedDeliveryDate,
            String quoteNote,
            String opticianEmail) {
        return adminConfirmPrepayQuote(
                orderNumber, revisedTotalAmount, promisedDeliveryDate, quoteNote, opticianEmail,
                null, null, null, null, null, null);
    }

    /**
     * P0-03: Publish a new immutable versioned quote, optionally reconfiguring frame SKU (with atomic
     * stock swap) and/or structured lens options so manufacturing uses the exact customer-confirmed plan.
     */
    @Transactional
    public OrderDetailResponseDTO adminConfirmPrepayQuote(
            String orderNumber,
            BigDecimal revisedTotalAmount,
            LocalDate promisedDeliveryDate,
            String quoteNote,
            String opticianEmail,
            Long targetSkuId,
            String targetFinishId,
            String targetSizeSpec,
            List<String> revisedLensOptionTypes,
            LocalDateTime quoteExpiresAt,
            String explicitChangeSummary) {
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (!OrderStatus.AWAITING_REVIEW.equalsIgnoreCase(order.getStatus())
                && !OrderStatus.QUOTE_READY.equalsIgnoreCase(order.getStatus())
                && !OrderStatus.PAID.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("订单当前状态（" + order.getStatus() + "）不支持验配报价确认。");
        }
        if (revisedTotalAmount != null && revisedTotalAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("调整后的报价必须大于 0。");
        }

        List<String> diffParts = new ArrayList<>();
        BigDecimal previousQuotedAmount = order.getQuoteRevisedAmount() != null
                ? order.getQuoteRevisedAmount()
                : order.getTotalAmount();
        LocalDate previousEstimatedDate = order.getEstimatedDeliveryDate();

        // 1. Optional SKU reconfiguration with atomic inventory swap (P0-03)
        boolean requestedSpecChange = targetSkuId != null
                || (targetFinishId != null && !targetFinishId.isBlank())
                || (targetSizeSpec != null && !targetSizeSpec.isBlank());
        if (requestedSpecChange && order.getProduct() != null && productSkuRepository != null) {
            String nextFinish = (targetFinishId != null && !targetFinishId.isBlank()) ? targetFinishId.trim() : order.getFinishId();
            String nextSize = (targetSizeSpec != null && !targetSizeSpec.isBlank()) ? targetSizeSpec.trim() : order.getSizeSpecSnapshot();
            ProductSku newSku = resolveSkuForCheckout(order.getProduct(), targetSkuId, nextFinish, nextSize);
            if (newSku != null && !Objects.equals(newSku.getId(), order.getSkuId())) {
                String skuStatus = newSku.getSalesStatus() != null ? newSku.getSalesStatus() : ProductSalesStatus.PAUSED;
                if (!ProductSalesStatus.AVAILABLE.equalsIgnoreCase(skuStatus) || newSku.getAvailableQty() <= 0) {
                    throw new IllegalStateException("调整后的目标色款/尺码当前库存不足或不可售，无法改配。");
                }
                int reserved = productSkuRepository.reserveStockIfAvailable(newSku.getId());
                if (reserved == 0) {
                    throw new IllegalStateException("目标规格库存已被占用，请刷新库存后重试。");
                }
                Long oldSkuId = order.getSkuId();
                String oldSpec = (order.getFinishId() != null ? order.getFinishId() : "-")
                        + "/" + (order.getSizeSpecSnapshot() != null ? order.getSizeSpecSnapshot() : "-");
                if (oldSkuId != null && !order.isStockReleased()) {
                    if (order.isSkuStockCommitted()) {
                        productSkuRepository.incrementOnHandStock(oldSkuId);
                    } else {
                        productSkuRepository.releaseReservedStock(oldSkuId);
                    }
                }
                order.setSkuId(newSku.getId());
                order.setFinishId(newSku.getFinishId());
                order.setSizeSpecSnapshot(newSku.getSizeSpec());
                if (newSku.getUnitCost() != null) {
                    order.setVariableCostAmount(newSku.getUnitCost());
                }
                syncProductAggregateStock(order.getProduct().getId());
                diffParts.add("规格变更: " + oldSpec + " -> " + newSku.getFinishId() + "/" + newSku.getSizeSpec());
            }
        }

        // 2. Optional structured lens reconfiguration synced to processing sheet (P0-03)
        BigDecimal recomputedLensAmount = null;
        if (revisedLensOptionTypes != null && !revisedLensOptionTypes.isEmpty()) {
            List<String> normalizedLenses = normalizeLensTypes(revisedLensOptionTypes);
            List<LensOption> foundLenses = lensOptionRepository.findByTypeIn(normalizedLenses);
            Map<String, LensOption> dedup = new LinkedHashMap<>();
            for (LensOption lo : foundLenses) {
                dedup.putIfAbsent(lo.getType(), lo);
            }
            if (dedup.size() != normalizedLenses.size()) {
                throw new IllegalArgumentException("调整后的镜片方案包含无效选项。");
            }
            List<LensOption> updatedLenses = new ArrayList<>(dedup.values());
            validateLensCombination(updatedLenses);

            List<String> oldLensTypes = order.getLensOptionTypes();
            if (!oldLensTypes.equals(normalizedLenses)) {
                diffParts.add("镜片调整: " + String.join("+", oldLensTypes) + " -> " + String.join("+", normalizedLenses));
            }
            order.setLensOptions(updatedLenses);
            order.setLensOptionsSnapshot(updatedLenses.stream()
                    .map(lo -> new OrderLensSnapshot(lo.getType(), lo.getLabel(), lo.getAdditionalPrice()))
                    .toList());
            if (order.getProduct() != null && order.getProduct().getBasePrice() != null) {
                BigDecimal lensSum = updatedLenses.stream()
                        .map(LensOption::getAdditionalPrice)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal discount = order.getDiscountAmount() != null ? order.getDiscountAmount() : BigDecimal.ZERO;
                recomputedLensAmount = order.getProduct().getBasePrice().add(lensSum)
                        .subtract(discount).add(order.getShippingFee());
                if (recomputedLensAmount.compareTo(BigDecimal.ZERO) < 0) {
                    recomputedLensAmount = BigDecimal.ZERO;
                }
            }
        }

        BigDecimal effectiveQuoteAmount = revisedTotalAmount != null
                ? revisedTotalAmount
                : (recomputedLensAmount != null ? recomputedLensAmount : order.getTotalAmount());
        if (previousQuotedAmount != null && effectiveQuoteAmount != null
                && previousQuotedAmount.compareTo(effectiveQuoteAmount) != 0) {
            diffParts.add("金额变更: ¥" + previousQuotedAmount.toPlainString() + " -> ¥" + effectiveQuoteAmount.toPlainString());
        }

        order.setQuoteRevisedAmount(effectiveQuoteAmount);
        if (quoteNote != null) {
            order.setQuoteNote(quoteNote.trim().isEmpty() ? null : quoteNote.trim());
        }

        LocalDateTime now = BusinessClock.now();
        order.setOpticianVerifiedBy(opticianEmail != null ? opticianEmail : "optician");
        order.setOpticianVerifiedAt(now);
        order.setOpticianVerifiedRxVersion(order.getPrescriptionVersion());

        LocalDate effectivePromisedDate;
        if (promisedDeliveryDate != null) {
            if (order.getInitialPromisedDeliveryDate() == null) {
                order.setInitialPromisedDeliveryDate(promisedDeliveryDate);
                order.setInitialPromisedSource("OPTICIAN_QUOTE");
            }
            order.setEstimatedDeliveryDate(promisedDeliveryDate);
            effectivePromisedDate = promisedDeliveryDate;
        } else if (order.getInitialPromisedDeliveryDate() == null) {
            LocalDate defaultPromised = BusinessClock.today().plusDays(14);
            order.setInitialPromisedDeliveryDate(defaultPromised);
            order.setInitialPromisedSource("OPTICIAN_QUOTE");
            if (order.getEstimatedDeliveryDate() == null) {
                order.setEstimatedDeliveryDate(defaultPromised);
            }
            effectivePromisedDate = order.getEstimatedDeliveryDate();
        } else {
            effectivePromisedDate = order.getEstimatedDeliveryDate();
        }
        if (previousEstimatedDate != null && effectivePromisedDate != null
                && !previousEstimatedDate.equals(effectivePromisedDate)) {
            diffParts.add("交期变更: " + previousEstimatedDate + " -> " + effectivePromisedDate);
        }

        int nextVersion = order.getQuoteVersion() + 1;
        order.setQuoteVersion(nextVersion);
        LocalDateTime effectiveExpiry = quoteExpiresAt != null ? quoteExpiresAt : now.plusHours(DEFAULT_QUOTE_HOLD_HOURS);
        order.setQuoteExpiresAt(effectiveExpiry);

        String changeSummary = (explicitChangeSummary != null && !explicitChangeSummary.isBlank())
                ? explicitChangeSummary.trim()
                : (!diffParts.isEmpty() ? String.join("；", diffParts) : (nextVersion == 1 ? "首次验配报价方案" : "方案备注或有效期更新"));
        order.setQuoteChangeSummary(changeSummary);

        if (OrderStatus.AWAITING_REVIEW.equalsIgnoreCase(order.getStatus())
                || OrderStatus.QUOTE_READY.equalsIgnoreCase(order.getStatus())) {
            order.setStatus(OrderStatus.QUOTE_READY);
            order.setDeliveryReviewRequired(false);
        }

        orderRepository.save(order);

        if (orderQuoteVersionRepository != null) {
            OrderQuoteVersion qv = new OrderQuoteVersion();
            qv.setOrderNumber(order.getOrderNumber());
            qv.setVersionNumber(nextVersion);
            qv.setProductId(order.getProduct() != null ? order.getProduct().getId() : null);
            qv.setSkuId(order.getSkuId());
            qv.setFinishId(order.getFinishId());
            qv.setSizeSpec(order.getSizeSpecSnapshot());
            qv.setLensOptionsSnapshot(order.getLensOptionsSnapshot() != null
                    ? new ArrayList<>(order.getLensOptionsSnapshot()) : List.of());
            qv.setQuotedAmount(effectiveQuoteAmount);
            qv.setPromisedDeliveryDate(effectivePromisedDate);
            qv.setExpiresAt(effectiveExpiry);
            qv.setQuoteNote(order.getQuoteNote());
            qv.setChangeSummary(changeSummary);
            qv.setCreatedBy(order.getOpticianVerifiedBy());
            qv.setCreatedAt(now);
            orderQuoteVersionRepository.save(qv);
        }

        Order fresh = orderRepository.findByOrderNumber(orderNumber).orElse(order);
        return toOrderDetailResponseDTO(fresh, true);
    }

    @Transactional
    public OrderResponseDTO customerConfirmQuoteAndPay(
            String orderNumber,
            String authenticatedEmail,
            String channelOverride) {
        return customerConfirmQuoteAndPay(orderNumber, authenticatedEmail, channelOverride, null);
    }

    /**
     * P0-03: Customer quote confirmation strictly bound to the exact quoteVersion the user viewed.
     * - Stale/missing version -> throws QuoteVersionConflictException (HTTP 409)
     * - Expired quote -> throws IllegalStateException
     * - Repeat confirmation on the SAME valid version -> idempotently returns the same pending payment!
     * - Allowed even when checkout kill switch is paused for new orders (Section 6 P0).
     */
    @Transactional
    public OrderResponseDTO customerConfirmQuoteAndPay(
            String orderNumber,
            String authenticatedEmail,
            String channelOverride,
            Integer expectedQuoteVersion) {
        UserAccount user = userService.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        ensureOwnerOrStaff(order, user);

        String channel = (channelOverride != null && !channelOverride.isBlank())
                ? channelOverride.trim().toUpperCase()
                : (order.getPaymentChannel() != null && !order.getPaymentChannel().isBlank()
                        ? order.getPaymentChannel()
                        : "ALIPAY");

        // Idempotent repeat click on the SAME valid quote version -> return the same order & payment
        if (OrderStatus.PENDING_PAYMENT.equalsIgnoreCase(order.getStatus())
                && order.getCustomerQuoteConfirmedAt() != null) {
            if (expectedQuoteVersion != null && !expectedQuoteVersion.equals(order.getQuoteVersion())) {
                throw new QuoteVersionConflictException(
                        "报价版本已更新为 v" + order.getQuoteVersion() + "，请刷新页面核对后再操作。",
                        order.getQuoteVersion());
            }
            PaymentInitiateResult replayPay = paymentService.initiatePayment(
                    order.getOrderNumber(), order.getTotalAmount(),
                    order.getPaymentChannel() != null ? order.getPaymentChannel() : channel);
            return new OrderResponseDTO(
                    order.getOrderNumber(),
                    order.getStatus(),
                    order.getTotalAmount(),
                    resolveProductName(order),
                    order.getLensOptionTypes(),
                    replayPay.payData(),
                    order.getFinishId(),
                    order.getSkuId(),
                    order.getSizeSpecSnapshot(),
                    order.getQuoteVersion(),
                    order.getShippingFee()
            );
        }

        if (!OrderStatus.QUOTE_READY.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("该订单尚未进入待用户确认方案状态（当前：" + order.getStatus() + "）。");
        }

        LocalDateTime now = BusinessClock.now();
        if (order.getQuoteExpiresAt() != null && now.isAfter(order.getQuoteExpiresAt())) {
            throw new IllegalStateException("该报价已过有效期（" + order.getQuoteExpiresAt() + "），请联系验配师重新确认方案与库存。");
        }

        // Strict version binding check (P0-03)
        int currentVersion = order.getQuoteVersion();
        if (currentVersion > 0 && !Integer.valueOf(currentVersion).equals(expectedQuoteVersion)) {
            String changeHint = order.getQuoteChangeSummary() != null && !order.getQuoteChangeSummary().isBlank()
                    ? "变动内容：" + order.getQuoteChangeSummary() + "。"
                    : "";
            throw new QuoteVersionConflictException(
                    "验配报价已更新至最新版本 v" + currentVersion + "，" + changeHint + "请刷新并重新确认最新价格、镜片方案与交期后再支付。",
                    currentVersion);
        }

        BigDecimal effectiveTotal = order.getQuoteRevisedAmount() != null
                ? order.getQuoteRevisedAmount()
                : order.getTotalAmount();
        if (effectiveTotal == null || effectiveTotal.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("无效订单金额，无法发起在线支付。");
        }

        order.setTotalAmount(effectiveTotal);
        order.setCustomerQuoteConfirmedAt(now);
        order.setPaymentChannel(channel);
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        if (order.getInitialPromisedDeliveryDate() == null && order.getEstimatedDeliveryDate() != null) {
            order.setInitialPromisedDeliveryDate(order.getEstimatedDeliveryDate());
            if (order.getInitialPromisedSource() == null) {
                order.setInitialPromisedSource("OPTICIAN_QUOTE");
            }
        }

        PaymentInitiateResult payResult = paymentService.initiatePayment(
                order.getOrderNumber(), effectiveTotal, channel);
        order.setGatewayTransactionId(payResult.transactionId());
        orderRepository.save(order);

        if (orderQuoteVersionRepository != null && currentVersion > 0) {
            orderQuoteVersionRepository.findByOrderNumberAndVersionNumber(order.getOrderNumber(), currentVersion)
                    .ifPresent(qv -> {
                        qv.setConfirmedAt(now);
                        orderQuoteVersionRepository.save(qv);
                    });
        }

        return new OrderResponseDTO(
                order.getOrderNumber(),
                order.getStatus(),
                order.getTotalAmount(),
                resolveProductName(order),
                order.getLensOptionTypes(),
                payResult.payData(),
                order.getFinishId(),
                order.getSkuId(),
                order.getSizeSpecSnapshot(),
                order.getQuoteVersion(),
                order.getShippingFee()
        );
    }

    private void validateLensCombination(List<LensOption> options) {
        boolean hasCategorizedOptions = options.stream()
                .anyMatch(o -> "LENS".equalsIgnoreCase(o.getCategory()) || "COATING".equalsIgnoreCase(o.getCategory()));
        if (!hasCategorizedOptions) {
            return;
        }
        long baseLensCount = options.stream()
                .filter(o -> "LENS".equalsIgnoreCase(o.getCategory()))
                .count();
        if (baseLensCount == 0) {
            throw new IllegalArgumentException("请至少选择一款基础镜片（不能仅选择镀膜）。");
        }
        if (baseLensCount > 1) {
            throw new IllegalArgumentException("每副眼镜仅可选择一款基础镜片，请勿同时多选基础折射率镜片。");
        }
    }

    @Transactional
    public OrderResponseDTO resumePayment(String orderNumber, String authenticatedEmail, String channelOverride) {
        UserAccount user = userService.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        ensureOwnerOrStaff(order, user);

        if (OrderStatus.PAID.equalsIgnoreCase(order.getStatus())
                || OrderStatus.SHIPPED.equalsIgnoreCase(order.getStatus())
                || OrderStatus.DELIVERED.equalsIgnoreCase(order.getStatus())) {
            return new OrderResponseDTO(
                    order.getOrderNumber(),
                    order.getStatus(),
                    order.getTotalAmount(),
                    resolveProductName(order),
                    order.getLensOptionTypes(),
                    null,
                    order.getFinishId(),
                    order.getSkuId(),
                    order.getSizeSpecSnapshot(),
                    order.getQuoteVersion(),
                    order.getShippingFee()
            );
        }

        if (!OrderStatus.CREATED.equalsIgnoreCase(order.getStatus())
                && !OrderStatus.PENDING_PAYMENT.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("该订单当前状态为 " + order.getStatus() + "，无法继续支付。");
        }

        String channel = (channelOverride != null && !channelOverride.isBlank())
                ? channelOverride.trim().toUpperCase()
                : (order.getPaymentChannel() != null && !order.getPaymentChannel().isBlank()
                        ? order.getPaymentChannel()
                        : "ALIPAY");

        if (OrderStatus.PENDING_PAYMENT.equalsIgnoreCase(order.getStatus())
                && order.getPaymentChannel() != null
                && !order.getPaymentChannel().isBlank()) {
            PaymentQueryResult queryResult = paymentService.queryPayment(orderNumber, order.getPaymentChannel());
            if (queryResult != null && queryResult.status() == PaymentQueryStatus.PAID) {
                reconcileGatewayPaidResult(order, queryResult, "Payment discovered on resume check");
                return new OrderResponseDTO(
                        order.getOrderNumber(),
                        order.getStatus(),
                        order.getTotalAmount(),
                        resolveProductName(order),
                        order.getLensOptionTypes(),
                        null,
                        order.getFinishId(),
                        order.getSkuId(),
                        order.getSizeSpecSnapshot(),
                        order.getQuoteVersion(),
                        order.getShippingFee()
                );
            }
        }

        PaymentInitiateResult payResult = paymentService.initiatePayment(
                order.getOrderNumber(), order.getTotalAmount(), channel);
        order.setPaymentChannel(channel);
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setGatewayTransactionId(payResult.transactionId());
        orderRepository.save(order);

        return new OrderResponseDTO(
                order.getOrderNumber(),
                order.getStatus(),
                order.getTotalAmount(),
                resolveProductName(order),
                order.getLensOptionTypes(),
                payResult.payData(),
                order.getFinishId(),
                order.getSkuId(),
                order.getSizeSpecSnapshot(),
                order.getQuoteVersion(),
                order.getShippingFee()
        );
    }

    @Transactional
    public OrderDetailResponseDTO refreshPaymentStatus(String orderNumber, String authenticatedEmail) {
        UserAccount user = userService.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        ensureOwnerOrStaff(order, user);

        if (OrderStatus.PENDING_PAYMENT.equalsIgnoreCase(order.getStatus())
                && order.getPaymentChannel() != null
                && !order.getPaymentChannel().isBlank()) {
            PaymentQueryResult queryResult = paymentService.queryPayment(orderNumber, order.getPaymentChannel());
            if (queryResult != null) {
                if (queryResult.status() == PaymentQueryStatus.PAID) {
                    reconcileGatewayPaidResult(order, queryResult, "Payment confirmed on user refresh");
                } else if (queryResult.status() == PaymentQueryStatus.CLOSED) {
                    order.setStatus(OrderStatus.CANCELLED);
                    releaseCouponIfNeeded(order);
                    releaseStockIfNeeded(order);
                    orderRepository.save(order);
                }
            }
        }

        Order fresh = orderRepository.findByOrderNumber(orderNumber).orElse(order);
        return toOrderDetailResponseDTO(fresh, StaffRoles.isStaffRole(user.getRole()));
    }

    @Transactional(noRollbackFor = OrderCancellationDeferredException.class)
    public OrderDetailResponseDTO customerCancelOrder(String orderNumber, String authenticatedEmail) {
        UserAccount user = userService.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        ensureOwnerOrStaff(order, user);

        if (OrderStatus.PAID.equalsIgnoreCase(order.getStatus())) {
            String fulfillment = order.getFulfillmentStatus() != null ? order.getFulfillmentStatus() : FulfillmentStatus.PENDING_REVIEW;
            if (!FulfillmentStatus.PENDING_REVIEW.equalsIgnoreCase(fulfillment)
                    && !FulfillmentStatus.NEEDS_INFO.equalsIgnoreCase(fulfillment)) {
                throw new IllegalStateException("订单已进入加工/质检或发货阶段，无法自助取消，请在下方提交售后工单由客服协助处理。");
            }
        }

        adminCancelOrder(orderNumber);
        Order fresh = orderRepository.findByOrderNumber(orderNumber).orElse(order);
        return toOrderDetailResponseDTO(fresh, StaffRoles.isStaffRole(user.getRole()));
    }

    @Transactional
    public void completePayment(String orderNumber, String gatewayTransactionId, String paymentChannel) {
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));
        completePayment(orderNumber, gatewayTransactionId, paymentChannel, order.getTotalAmount());
    }

    @Transactional
    public void completePayment(String orderNumber, String gatewayTransactionId, String paymentChannel, BigDecimal paidAmount) {
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (OrderStatus.PAID.equalsIgnoreCase(order.getStatus()) ||
            OrderStatus.SHIPPED.equalsIgnoreCase(order.getStatus()) ||
            OrderStatus.DELIVERED.equalsIgnoreCase(order.getStatus()) ||
            OrderStatus.REFUND_PENDING.equalsIgnoreCase(order.getStatus()) ||
            OrderStatus.REFUNDED.equalsIgnoreCase(order.getStatus())) {
            log.info("Order {} payment already processed or in refund flow (status={}). Ignoring duplicate webhook callback.",
                    orderNumber, order.getStatus());
            return;
        }

        if (OrderStatus.CANCELLED.equalsIgnoreCase(order.getStatus()) || order.isCancelRequested()) {
            log.warn("Order {} was already CANCELLED or had a pending cancel request, but received a valid payment callback (txId={}). " +
                    "Recording transaction and initiating refund compensation.", orderNumber, gatewayTransactionId);
            order.setGatewayTransactionId(gatewayTransactionId);
            order.setPaidAt(BusinessClock.now());
            if (order.getPaymentChannel() == null && paymentChannel != null) {
                order.setPaymentChannel(paymentChannel);
            }
            BigDecimal refundAmount = paidAmount != null ? paidAmount : order.getTotalAmount();
            initiateRefundForCancelledOrder(order, refundAmount, "Late payment callback after order cancellation");
            releaseCouponIfNeeded(order);
            releaseStockIfNeeded(order);
            orderRepository.save(order);
            return;
        }

        if (paidAmount != null && order.getTotalAmount().compareTo(paidAmount) != 0) {
            log.error("Payment amount MISMATCH for order {}: expected {}, received {} from channel {}",
                    orderNumber, order.getTotalAmount(), paidAmount, paymentChannel);
            throw new IllegalStateException("Payment amount mismatch: expected " + order.getTotalAmount()
                    + " but received " + paidAmount);
        }

        markOrderPaid(order, gatewayTransactionId, paymentChannel);
    }

    private void reconcileGatewayPaidResult(Order order, PaymentQueryResult queryResult, String context) {
        if (order.isCancelRequested()) {
            log.info("Order {} had a pending cancel request and was found PAID at gateway ({}); initiating refund.",
                    order.getOrderNumber(), context);
            order.setGatewayTransactionId(queryResult.gatewayTransactionId());
            order.setPaidAt(BusinessClock.now());
            BigDecimal refundAmt = queryResult.paidAmount() != null ? queryResult.paidAmount() : order.getTotalAmount();
            initiateRefundForCancelledOrder(order, refundAmt, "Cancel request completed on payment reconciliation");
            releaseCouponIfNeeded(order);
            releaseStockIfNeeded(order);
            orderRepository.save(order);
            return;
        }
        if (queryResult.paidAmount() != null && order.getTotalAmount().compareTo(queryResult.paidAmount()) != 0) {
            log.error("Gateway query reported mismatched paid amount for order {} ({}): expected {}, got {}",
                    order.getOrderNumber(), context, order.getTotalAmount(), queryResult.paidAmount());
            order.setGatewayTransactionId(queryResult.gatewayTransactionId());
            order.setPaidAt(BusinessClock.now());
            initiateRefundForCancelledOrder(order, queryResult.paidAmount(), "Payment amount mismatch on reconciliation");
            releaseCouponIfNeeded(order);
            releaseStockIfNeeded(order);
            orderRepository.save(order);
            return;
        }
        markOrderPaid(order, queryResult.gatewayTransactionId(), order.getPaymentChannel());
    }

    private void markOrderPaid(Order order, String gatewayTransactionId, String paymentChannel) {
        order.setStatus(OrderStatus.PAID);
        if (gatewayTransactionId != null && !gatewayTransactionId.isBlank()) {
            order.setGatewayTransactionId(gatewayTransactionId);
        }
        order.setPaidAt(BusinessClock.now());
        if (order.getPaymentChannel() == null && paymentChannel != null) {
            order.setPaymentChannel(paymentChannel);
        }
        // Only auto-advance to IN_PRODUCTION if optician already verified the CURRENT prescription version
        boolean verifiedCurrentRx = order.getOpticianVerifiedAt() != null
                && (order.getOpticianVerifiedRxVersion() == null
                    || Objects.equals(order.getOpticianVerifiedRxVersion(), order.getPrescriptionVersion()));
        if (verifiedCurrentRx
                && (order.getFulfillmentStatus() == null
                    || order.getFulfillmentStatus().isBlank()
                    || FulfillmentStatus.PENDING_REVIEW.equalsIgnoreCase(order.getFulfillmentStatus()))) {
            if (order.getOpticianVerifiedRxVersion() == null) {
                order.setOpticianVerifiedRxVersion(order.getPrescriptionVersion());
            }
            order.setFulfillmentStatus(FulfillmentStatus.IN_PRODUCTION);
        } else if (order.getFulfillmentStatus() == null || order.getFulfillmentStatus().isBlank()) {
            order.setFulfillmentStatus(FulfillmentStatus.PENDING_REVIEW);
        }
        if (order.getSkuId() != null && !order.isSkuStockCommitted() && productSkuRepository != null) {
            Long productId = order.getProduct() != null ? order.getProduct().getId() : null;
            productSkuRepository.commitReservedStock(order.getSkuId());
            order.setSkuStockCommitted(true);
            syncProductAggregateStock(productId);
        }
        orderRepository.save(order);

        log.info("Order {} successfully paid via channel: {} with txId: {}",
                order.getOrderNumber(), order.getPaymentChannel(), order.getGatewayTransactionId());

        try {
            String productName = resolveProductName(order);
            emailService.sendOrderConfirmation(
                    order.getCustomerEmail(),
                    order.getOrderNumber(),
                    productName.isBlank() ? "Klarheit Eyewear" : productName,
                    order.getTotalAmount().toPlainString());
        } catch (Exception e) {
            log.error("Failed to send order confirmation email for order: {}", order.getOrderNumber(), e);
        }
    }

    private void initiateRefundForCancelledOrder(Order order, BigDecimal refundAmount, String reason) {
        BigDecimal effectiveAmount = refundAmount != null
                ? refundAmount
                : (order.getPendingRefundAmount().compareTo(BigDecimal.ZERO) > 0
                        ? order.getPendingRefundAmount()
                        : (order.getRefundAmount() != null ? order.getRefundAmount() : order.getTotalAmount()));
        String effectiveReason = (reason != null && !reason.isBlank())
                ? reason
                : (order.getRefundReason() != null && !order.getRefundReason().isBlank()
                        ? order.getRefundReason()
                        : "Order cancelled");
        String requestId = (order.getRefundRequestId() != null && !order.getRefundRequestId().isBlank())
                ? order.getRefundRequestId()
                : order.getOrderNumber() + "-REFUND";

        order.setRefundReason(effectiveReason);
        order.setRefundRequestId(requestId);

        RefundTransaction tx = null;
        if (refundTransactionRepository != null) {
            tx = refundTransactionRepository.findByRefundRequestId(requestId).orElseGet(() -> {
                RefundTransaction created = new RefundTransaction();
                created.setRefundRequestId(requestId);
                created.setOrderNumber(order.getOrderNumber());
                created.setRequestedAmount(effectiveAmount);
                created.setPaymentChannel(order.getPaymentChannel());
                created.setReason(effectiveReason);
                created.setRequestedBy("system");
                created.setRequestedAt(BusinessClock.now());
                created.setStatus(RefundStatus.PENDING_CHANNEL);
                return created;
            });
        }

        String channel = order.getPaymentChannel();
        RefundResult result = RefundResult.failed("No payment channel configured");
        if (channel != null && !channel.isBlank()) {
            try {
                result = invokeGatewayRefund(
                        order.getOrderNumber(),
                        order.getGatewayTransactionId(),
                        effectiveAmount,
                        channel,
                        effectiveReason,
                        requestId);
            } catch (Exception e) {
                log.error("Exception while initiating refund for order {}", order.getOrderNumber(), e);
                result = RefundResult.failed(e.getMessage());
            }
        }

        if (result.confirmed()) {
            BigDecimal confirmedAmt = result.confirmedAmount() != null ? result.confirmedAmount() : effectiveAmount;
            if (tx != null) {
                tx.setStatus(RefundStatus.CONFIRMED);
                tx.setConfirmedAmount(confirmedAmt);
                tx.setConfirmedAt(BusinessClock.now());
                tx.setGatewayRefundId(result.gatewayRefundId());
                tx.setFailureMessage(null);
                refundTransactionRepository.save(tx);
                syncOrderRefundBalancesFromLedger(order);
            } else {
                order.setConfirmedRefundAmount(confirmedAmt);
                order.setPendingRefundAmount(BigDecimal.ZERO);
                order.setRefundAmount(confirmedAmt);
            }
            order.setStatus(OrderStatus.REFUNDED);
        } else {
            if (tx != null) {
                tx.setStatus(RefundStatus.FAILED);
                tx.setConfirmedAmount(null);
                tx.setConfirmedAt(null);
                tx.setFailureMessage(result.message());
                refundTransactionRepository.save(tx);
                syncOrderRefundBalancesFromLedger(order);
            } else {
                // Legacy mock test path without RefundTransactionRepository:
                // keep confirmedRefundAmount = 0, pendingRefundAmount = effectiveAmount,
                // while retaining refundAmount for retry persistence compatibility.
                order.setConfirmedRefundAmount(BigDecimal.ZERO);
                order.setPendingRefundAmount(effectiveAmount);
                order.setRefundAmount(effectiveAmount);
            }
            order.setStatus(OrderStatus.REFUND_PENDING);
        }
    }

    private RefundResult invokeGatewayRefund(
            String orderNumber,
            String gatewayTransactionId,
            BigDecimal amount,
            String channel,
            String reason,
            String refundRequestId) {
        RefundResult result = paymentService.refundPaymentWithRequestId(
                orderNumber, gatewayTransactionId, amount, channel, reason, refundRequestId);
        if (result != null) {
            return result;
        }
        boolean legacyOk = paymentService.refundPayment(orderNumber, gatewayTransactionId, amount, channel, reason);
        return legacyOk
                ? RefundResult.confirmed(refundRequestId, amount)
                : RefundResult.failed("Gateway refund returned false");
    }

    public void syncOrderRefundBalancesFromLedger(Order order) {
        if (refundTransactionRepository == null || order == null) return;
        List<RefundTransaction> txs = refundTransactionRepository.findByOrderNumberOrderByRequestedAtAsc(order.getOrderNumber());
        BigDecimal confirmed = BigDecimal.ZERO;
        BigDecimal pending = BigDecimal.ZERO;
        for (RefundTransaction item : txs) {
            if (RefundStatus.CONFIRMED.equalsIgnoreCase(item.getStatus())) {
                BigDecimal amt = item.getConfirmedAmount() != null ? item.getConfirmedAmount() : item.getRequestedAmount();
                if (amt != null) confirmed = confirmed.add(amt);
            } else if (RefundStatus.REQUESTED.equalsIgnoreCase(item.getStatus())
                    || RefundStatus.PENDING_CHANNEL.equalsIgnoreCase(item.getStatus())
                    || RefundStatus.FAILED.equalsIgnoreCase(item.getStatus())) {
                if (item.getRequestedAmount() != null) pending = pending.add(item.getRequestedAmount());
            }
        }
        order.setConfirmedRefundAmount(confirmed);
        order.setPendingRefundAmount(pending);
        // P0-06: Order.refundAmount strictly reflects CONFIRMED refunds only when ledger is active
        order.setRefundAmount(confirmed.compareTo(BigDecimal.ZERO) > 0 ? confirmed : null);
    }

    private void releaseCouponIfNeeded(Order order) {
        if (!order.isCouponReleased()
                && order.getAppliedCouponCode() != null
                && !order.getAppliedCouponCode().isBlank()) {
            couponService.decrementCouponUsage(order.getAppliedCouponCode());
            order.setCouponReleased(true);
            log.info("Released coupon usage for order {} using coupon code {}",
                    order.getOrderNumber(), order.getAppliedCouponCode());
        }
    }

    private void releaseStockIfNeeded(Order order) {
        if (order.isStockReleased()) {
            return;
        }
        if (order.getSkuId() != null && productSkuRepository != null) {
            Long productId = order.getProduct() != null ? order.getProduct().getId() : null;
            if (order.isSkuStockCommitted()) {
                productSkuRepository.incrementOnHandStock(order.getSkuId());
                log.info("Restored 1 physical on-hand unit for SKU {} from cancelled paid order {}",
                        order.getSkuId(), order.getOrderNumber());
            } else {
                productSkuRepository.releaseReservedStock(order.getSkuId());
                log.info("Released 1 reserved unit for SKU {} from unpaid cancelled order {}",
                        order.getSkuId(), order.getOrderNumber());
            }
            order.setStockReleased(true);
            syncProductAggregateStock(productId);
            return;
        }
        if (order.getProduct() != null && order.getProduct().getId() != null) {
            productRepository.incrementStock(order.getProduct().getId());
            order.setStockReleased(true);
            evictProductCatalogCache();
            log.info("Released 1 unit of stock for product {} from cancelled/refunded order {}",
                    order.getProduct().getId(), order.getOrderNumber());
        }
    }

    private void syncProductAggregateStock(Long productId) {
        if (productId == null || productSkuRepository == null) {
            return;
        }
        Integer totalAvail = productSkuRepository.sumAvailableQtyByProductId(productId);
        if (totalAvail != null) {
            productRepository.updateStockQuantity(productId, Math.max(0, totalAvail));
            evictProductCatalogCache();
        }
    }

    private void evictProductCatalogCache() {
        if (cacheManager == null) {
            return;
        }
        Cache cache = cacheManager.getCache("productCatalog");
        if (cache != null) {
            cache.clear();
        }
    }

    /**
     * P0-02: Expires CREATED, PENDING_PAYMENT, AWAITING_REVIEW, and QUOTE_READY holds atomically
     * under a pessimistic write lock so confirmation/payment and timeout closure are mutually exclusive.
     */
    @Transactional
    public void cancelExpiredOrder(String orderNumber) {
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        String status = order.getStatus();
        boolean isStandardUnpaid = OrderStatus.CREATED.equalsIgnoreCase(status)
                || OrderStatus.PENDING_PAYMENT.equalsIgnoreCase(status);
        boolean isPrepayHold = OrderStatus.AWAITING_REVIEW.equalsIgnoreCase(status)
                || OrderStatus.QUOTE_READY.equalsIgnoreCase(status);

        if (!isStandardUnpaid && !isPrepayHold) {
            log.info("Order {} is in status {}. Skipping expiration cancellation.", orderNumber, status);
            return;
        }

        LocalDateTime now = BusinessClock.now();
        if (OrderStatus.AWAITING_REVIEW.equalsIgnoreCase(status) && !order.isCancelRequested()) {
            LocalDateTime deadline = order.getReviewExpiresAt() != null
                    ? order.getReviewExpiresAt()
                    : (order.getCreatedAt() != null ? order.getCreatedAt().plusHours(DEFAULT_REVIEW_HOLD_HOURS) : null);
            if (deadline != null && !now.isAfter(deadline)) {
                return;
            }
        }
        if (OrderStatus.QUOTE_READY.equalsIgnoreCase(status) && !order.isCancelRequested()) {
            LocalDateTime deadline = order.getQuoteExpiresAt() != null
                    ? order.getQuoteExpiresAt()
                    : (order.getOpticianVerifiedAt() != null
                            ? order.getOpticianVerifiedAt().plusHours(DEFAULT_QUOTE_HOLD_HOURS)
                            : (order.getCreatedAt() != null ? order.getCreatedAt().plusHours(DEFAULT_QUOTE_HOLD_HOURS) : null));
            if (deadline != null && !now.isAfter(deadline)) {
                return;
            }
        }

        if (OrderStatus.PENDING_PAYMENT.equalsIgnoreCase(status)
                && order.getPaymentChannel() != null
                && !order.getPaymentChannel().isBlank()) {
            PaymentQueryResult queryResult = paymentService.queryPayment(orderNumber, order.getPaymentChannel());
            if (queryResult != null) {
                if (queryResult.status() == PaymentQueryStatus.PAID) {
                    reconcileGatewayPaidResult(order, queryResult, "expiration check");
                    return;
                }
                if (queryResult.status() == PaymentQueryStatus.UNKNOWN) {
                    log.warn("Gateway query status UNKNOWN for expired order {} ({}); deferring cancellation.",
                            orderNumber, queryResult.message());
                    return;
                }
                if (queryResult.status() == PaymentQueryStatus.UNPAID) {
                    boolean closed = paymentService.closePayment(orderNumber, order.getPaymentChannel());
                    if (!closed) {
                        PaymentQueryResult recheck = paymentService.queryPayment(orderNumber, order.getPaymentChannel());
                        if (recheck != null && recheck.status() == PaymentQueryStatus.PAID) {
                            reconcileGatewayPaidResult(order, recheck, "concurrent payment during trade close");
                            return;
                        }
                        log.warn("Could not close gateway trade for order {}; deferring cancellation.", orderNumber);
                        return;
                    }
                }
            }
        }

        order.setStatus(OrderStatus.CANCELLED);
        releaseCouponIfNeeded(order);
        releaseStockIfNeeded(order);
        orderRepository.save(order);
        log.info("Order {} (was {}) has been cancelled due to expiration; stock & coupon released.", orderNumber, status);
    }

    @Transactional
    public void retryPendingRefund(String orderNumber) {
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (!OrderStatus.REFUND_PENDING.equalsIgnoreCase(order.getStatus())) {
            return;
        }

        BigDecimal effectiveAmount = order.getPendingRefundAmount().compareTo(BigDecimal.ZERO) > 0
                ? order.getPendingRefundAmount()
                : (order.getRefundAmount() != null ? order.getRefundAmount() : order.getTotalAmount());
        String effectiveReason = (order.getRefundReason() != null && !order.getRefundReason().isBlank())
                ? order.getRefundReason()
                : "Scheduled refund compensation retry";
        String requestId = (order.getRefundRequestId() != null && !order.getRefundRequestId().isBlank())
                ? order.getRefundRequestId()
                : order.getOrderNumber() + "-REFUND";

        order.setRefundReason(effectiveReason);
        order.setRefundRequestId(requestId);

        RefundResult result = invokeGatewayRefund(
                order.getOrderNumber(),
                order.getGatewayTransactionId(),
                effectiveAmount,
                order.getPaymentChannel(),
                effectiveReason,
                requestId);

        if (refundTransactionRepository != null) {
            RefundTransaction tx = refundTransactionRepository.findByRefundRequestId(requestId).orElseGet(() -> {
                RefundTransaction created = new RefundTransaction();
                created.setRefundRequestId(requestId);
                created.setOrderNumber(order.getOrderNumber());
                created.setRequestedAmount(effectiveAmount);
                created.setPaymentChannel(order.getPaymentChannel());
                created.setReason(effectiveReason);
                created.setRequestedBy("scheduler");
                created.setRequestedAt(BusinessClock.now());
                return created;
            });
            if (result.confirmed()) {
                tx.setStatus(RefundStatus.CONFIRMED);
                tx.setConfirmedAmount(result.confirmedAmount() != null ? result.confirmedAmount() : effectiveAmount);
                tx.setConfirmedAt(BusinessClock.now());
                tx.setGatewayRefundId(result.gatewayRefundId());
                tx.setFailureMessage(null);
            } else {
                tx.setStatus(RefundStatus.FAILED);
                tx.setFailureMessage(result.message());
            }
            refundTransactionRepository.save(tx);
            syncOrderRefundBalancesFromLedger(order);
        }

        if (result.confirmed()) {
            if (refundTransactionRepository == null) {
                order.setConfirmedRefundAmount(effectiveAmount);
                order.setPendingRefundAmount(BigDecimal.ZERO);
                order.setRefundAmount(effectiveAmount);
            }
            order.setStatus(OrderStatus.REFUNDED);
            log.info("Order {} refund compensation succeeded; status updated to REFUNDED.", orderNumber);
        }
        orderRepository.save(order);
    }

    @Transactional(noRollbackFor = OrderCancellationDeferredException.class)
    public String adminCancelOrder(String orderNumber) {
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        String previousStatus = order.getStatus();
        if (OrderStatus.SHIPPED.equalsIgnoreCase(previousStatus)
                || OrderStatus.DELIVERED.equalsIgnoreCase(previousStatus)) {
            throw new IllegalStateException("Cannot cancel an order that has already been shipped or delivered.");
        }

        if (OrderStatus.CANCELLED.equalsIgnoreCase(previousStatus)
                || OrderStatus.REFUND_PENDING.equalsIgnoreCase(previousStatus)
                || OrderStatus.REFUNDED.equalsIgnoreCase(previousStatus)) {
            return previousStatus;
        }

        if (OrderStatus.PAID.equalsIgnoreCase(previousStatus)) {
            order.setCancelRequested(true);
            initiateRefundForCancelledOrder(order, order.getTotalAmount(), "Cancelled paid order");
            releaseCouponIfNeeded(order);
            releaseStockIfNeeded(order);
            orderRepository.save(order);
            return previousStatus;
        }

        if (OrderStatus.PENDING_PAYMENT.equalsIgnoreCase(previousStatus)
                && order.getPaymentChannel() != null
                && !order.getPaymentChannel().isBlank()) {
            PaymentQueryResult queryResult = paymentService.queryPayment(orderNumber, order.getPaymentChannel());
            if (queryResult != null) {
                if (queryResult.status() == PaymentQueryStatus.PAID) {
                    order.setCancelRequested(true);
                    order.setGatewayTransactionId(queryResult.gatewayTransactionId());
                    order.setPaidAt(BusinessClock.now());
                    BigDecimal refundAmt = queryResult.paidAmount() != null ? queryResult.paidAmount() : order.getTotalAmount();
                    initiateRefundForCancelledOrder(order, refundAmt, "Cancelled order that was already paid at gateway");
                    releaseCouponIfNeeded(order);
                    releaseStockIfNeeded(order);
                    orderRepository.save(order);
                    return previousStatus;
                }
                if (queryResult.status() == PaymentQueryStatus.UNKNOWN) {
                    order.setCancelRequested(true);
                    orderRepository.save(order);
                    throw new OrderCancellationDeferredException("支付状态核对中，暂未取消，请稍后重试");
                }
                if (queryResult.status() == PaymentQueryStatus.UNPAID) {
                    boolean closed = paymentService.closePayment(orderNumber, order.getPaymentChannel());
                    if (!closed) {
                        PaymentQueryResult recheck = paymentService.queryPayment(orderNumber, order.getPaymentChannel());
                        if (recheck != null && recheck.status() == PaymentQueryStatus.PAID) {
                            order.setCancelRequested(true);
                            order.setGatewayTransactionId(recheck.gatewayTransactionId());
                            order.setPaidAt(BusinessClock.now());
                            BigDecimal refundAmt = recheck.paidAmount() != null ? recheck.paidAmount() : order.getTotalAmount();
                            initiateRefundForCancelledOrder(order, refundAmt, "Cancelled order paid concurrently during trade close");
                            releaseCouponIfNeeded(order);
                            releaseStockIfNeeded(order);
                            orderRepository.save(order);
                            return previousStatus;
                        }
                        order.setCancelRequested(true);
                        orderRepository.save(order);
                        throw new OrderCancellationDeferredException("支付状态核对中，暂未取消，请稍后重试");
                    }
                }
            }
        }

        order.setCancelRequested(true);
        order.setStatus(OrderStatus.CANCELLED);
        releaseCouponIfNeeded(order);
        releaseStockIfNeeded(order);
        orderRepository.save(order);
        return previousStatus;
    }

    // ── P0-04 Explicit Optician Verification, Production, QC, Shipment & Tracking Actions ──

    /**
     * Step 1: Explicit optician prescription verification bound to current prescriptionVersion.
     */
    @Transactional
    public OrderDetailResponseDTO adminVerifyOpticianPrescription(
            String orderNumber,
            String note,
            String opticianEmail) {
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (!OrderStatus.PAID.equalsIgnoreCase(order.getStatus())
                && !OrderStatus.AWAITING_REVIEW.equalsIgnoreCase(order.getStatus())
                && !OrderStatus.QUOTE_READY.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("订单当前状态（" + order.getStatus() + "）不支持验配复核确认。");
        }
        order.setOpticianVerifiedBy(opticianEmail != null ? opticianEmail : "optician");
        order.setOpticianVerifiedAt(BusinessClock.now());
        order.setOpticianVerifiedRxVersion(order.getPrescriptionVersion());
        if (note != null && !note.isBlank()) {
            order.setFulfillmentNote(note.trim());
        }
        orderRepository.save(order);
        Order fresh = orderRepository.findByOrderNumber(orderNumber).orElse(order);
        return toOrderDetailResponseDTO(fresh, true);
    }

    /**
     * When prescription or processing plan changes, increment prescriptionVersion and invalidate
     * prior optician verification and QC pass so the workshop must re-verify & re-QC.
     */
    @Transactional
    public OrderDetailResponseDTO adminReviseOrderPrescription(
            String orderNumber,
            PrescriptionDetailsDTO updatedRx,
            String note,
            String operatorEmail) {
        if (updatedRx == null) {
            throw new IllegalArgumentException("处方参数不能为空。");
        }
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));
        if (OrderStatus.SHIPPED.equalsIgnoreCase(order.getStatus())
                || OrderStatus.DELIVERED.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("已发货或已签收订单不可修改原单处方，请走售后重做流程。");
        }

        Prescription rx = order.getPrescription();
        if (rx == null) {
            rx = new Prescription();
            rx.setUserId(order.getUserId());
        }
        rx.setSphOd(updatedRx.sphOd());
        rx.setSphOs(updatedRx.sphOs());
        rx.setCylOd(updatedRx.cylOd());
        rx.setCylOs(updatedRx.cylOs());
        rx.setAxisOd(updatedRx.axisOd());
        rx.setAxisOs(updatedRx.axisOs());
        rx.setPd(updatedRx.pd());
        prescriptionRepository.save(rx);
        order.setPrescription(rx);

        order.setPrescriptionVersion(order.getPrescriptionVersion() + 1);
        order.setOpticianVerifiedAt(null);
        order.setOpticianVerifiedBy(null);
        order.setOpticianVerifiedRxVersion(null);
        order.setQcStatus("PENDING");
        order.setQcCheckedAt(null);
        order.setQcCheckedBy(null);
        order.setFulfillmentStatus(FulfillmentStatus.PENDING_REVIEW);
        if (note != null && !note.isBlank()) {
            order.setFulfillmentNote(note.trim());
        }
        orderRepository.save(order);
        Order fresh = orderRepository.findByOrderNumber(orderNumber).orElse(order);
        return toOrderDetailResponseDTO(fresh, true);
    }

    /**
     * Step 2: Explicit transition into IN_PRODUCTION — requires optician verification of current rx version.
     */
    @Transactional
    public OrderDetailResponseDTO adminStartProduction(
            String orderNumber,
            LocalDate estimatedDeliveryDate,
            String note,
            String operatorEmail) {
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (!OrderStatus.PAID.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("仅已付款订单可进入加工制作（当前：" + order.getStatus() + "）。");
        }
        ensureOpticianVerifiedCurrentRx(order);
        validateFulfillmentTransition(order.getFulfillmentStatus(), FulfillmentStatus.IN_PRODUCTION);

        order.setFulfillmentStatus(FulfillmentStatus.IN_PRODUCTION);
        if ("FAILED".equalsIgnoreCase(order.getQcStatus())) {
            order.setQcStatus("PENDING");
        }
        if (note != null && !note.isBlank()) {
            order.setFulfillmentNote(note.trim());
        }
        if (estimatedDeliveryDate != null) {
            if (order.getInitialPromisedDeliveryDate() == null) {
                order.setInitialPromisedDeliveryDate(estimatedDeliveryDate);
                order.setInitialPromisedSource("OPTICIAN_QUOTE");
            }
            order.setEstimatedDeliveryDate(estimatedDeliveryDate);
        }
        orderRepository.save(order);
        Order fresh = orderRepository.findByOrderNumber(orderNumber).orElse(order);
        return toOrderDetailResponseDTO(fresh, true);
    }

    /**
     * Step 3: Explicit factory QC inspection (PASSED or FAILED) — requires order in IN_PRODUCTION / QC_PASSED.
     */
    @Transactional
    public OrderDetailResponseDTO adminRecordQcResult(
            String orderNumber,
            String qcStatus,
            String qcNote,
            String qcEmail) {
        if (qcStatus == null || qcStatus.isBlank()) {
            throw new IllegalArgumentException("质检结果不能为空（PASSED / FAILED）。");
        }
        String normalizedQc = qcStatus.trim().toUpperCase();
        if (!"PASSED".equals(normalizedQc) && !"FAILED".equals(normalizedQc)) {
            throw new IllegalArgumentException("质检结果仅支持 PASSED 或 FAILED：" + qcStatus);
        }

        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (!OrderStatus.PAID.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("仅已付款待出库订单可录入出厂质检（当前：" + order.getStatus() + "）。");
        }
        ensureOpticianVerifiedCurrentRx(order);
        String currentStage = order.getFulfillmentStatus() != null ? order.getFulfillmentStatus() : FulfillmentStatus.PENDING_REVIEW;
        if (!FulfillmentStatus.IN_PRODUCTION.equalsIgnoreCase(currentStage)
                && !FulfillmentStatus.QC_PASSED.equalsIgnoreCase(currentStage)) {
            throw new IllegalStateException("订单须先进入制作中（IN_PRODUCTION）才可录入出厂质检（当前阶段：" + currentStage + "）。");
        }

        order.setQcStatus(normalizedQc);
        order.setQcCheckedBy(qcEmail != null ? qcEmail : "qc");
        order.setQcCheckedAt(BusinessClock.now());
        if (qcNote != null) {
            order.setQcNote(qcNote.trim().isEmpty() ? null : qcNote.trim());
        }
        if ("PASSED".equals(normalizedQc)) {
            order.setFulfillmentStatus(FulfillmentStatus.QC_PASSED);
        } else {
            order.setFulfillmentStatus(FulfillmentStatus.IN_PRODUCTION);
        }
        orderRepository.save(order);
        Order fresh = orderRepository.findByOrderNumber(orderNumber).orElse(order);
        return toOrderDetailResponseDTO(fresh, true);
    }

    @Transactional
    public void adminShipOrder(String orderNumber, String carrier, String trackingNumber) {
        adminShipOrder(orderNumber, carrier, trackingNumber, "warehouse");
    }

    /**
     * Step 4 (P0-04): First shipment strictly gated on verified optician rx + REAL QC PASSED.
     * Re-submitting the identical carrier/tracking is idempotent and DOES NOT duplicate notification email.
     * Updating tracking on an already-shipped order is recorded separately as TRACKING_UPDATE preserving firstShippedAt.
     */
    @Transactional
    public void adminShipOrder(String orderNumber, String carrier, String trackingNumber, String operatorEmail) {
        if (carrier == null || carrier.isBlank() || trackingNumber == null || trackingNumber.isBlank()) {
            throw new IllegalArgumentException("Carrier and tracking number are required.");
        }
        String trimmedCarrier = carrier.trim();
        String trimmedTracking = trackingNumber.trim();

        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (!OrderStatus.PAID.equalsIgnoreCase(order.getStatus())
                && !OrderStatus.SHIPPED.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalArgumentException("Only PAID orders can be shipped.");
        }

        // Already shipped: separate tracking update vs idempotent repeat submission
        if (OrderStatus.SHIPPED.equalsIgnoreCase(order.getStatus()) || order.getFirstShippedAt() != null) {
            adminUpdateTracking(orderNumber, trimmedCarrier, trimmedTracking, "运单信息更新", operatorEmail);
            return;
        }

        // Strict pre-shipment gates for INITIAL_SHIP (P0-04)
        if (FulfillmentStatus.NEEDS_INFO.equalsIgnoreCase(order.getFulfillmentStatus())
                || FulfillmentStatus.EXCEPTION.equalsIgnoreCase(order.getFulfillmentStatus())) {
            throw new IllegalStateException("该订单处于待补资料或异常拦截状态，请先解除异常并完成质检后再发货。");
        }
        ensureOpticianVerifiedCurrentRx(order);
        if ("FAILED".equalsIgnoreCase(order.getQcStatus())) {
            throw new IllegalStateException("该订单出厂质检未通过，请先返工复检合格后再发货。");
        }
        if (!"PASSED".equalsIgnoreCase(order.getQcStatus())
                || order.getQcCheckedAt() == null
                || !FulfillmentStatus.QC_PASSED.equalsIgnoreCase(order.getFulfillmentStatus())) {
            throw new IllegalStateException("该订单尚未通过出厂质检（需先完成质检 PASSED 后方可首次出库发货）。");
        }

        LocalDateTime now = BusinessClock.now();
        order.setStatus(OrderStatus.SHIPPED);
        order.setFulfillmentStatus(FulfillmentStatus.SHIPPED);
        order.setCarrier(trimmedCarrier);
        order.setTrackingNumber(trimmedTracking);
        order.setFirstShippedAt(now);

        boolean shouldNotify = !trimmedTracking.equalsIgnoreCase(order.getShippingNotifiedTracking());
        boolean sent = false;
        if (shouldNotify) {
            try {
                emailService.sendShippingNotification(
                        order.getCustomerEmail(),
                        order.getOrderNumber(),
                        resolveProductName(order),
                        trimmedCarrier,
                        trimmedTracking
                );
                order.setShippingNotifiedTracking(trimmedTracking);
                sent = true;
            } catch (Exception e) {
                log.error("Failed to send shipping notification email for order {}", orderNumber, e);
            }
        }
        orderRepository.save(order);

        if (orderShipmentEventRepository != null) {
            OrderShipmentEvent evt = new OrderShipmentEvent();
            evt.setOrderNumber(order.getOrderNumber());
            evt.setEventType(OrderShipmentEvent.TYPE_INITIAL_SHIP);
            evt.setCarrier(trimmedCarrier);
            evt.setTrackingNumber(trimmedTracking);
            evt.setOperatorEmail(operatorEmail);
            evt.setNotificationSent(sent);
            evt.setCreatedAt(now);
            orderShipmentEventRepository.save(evt);
        }
    }

    /**
     * P0-04: Dedicated tracking correction on an already-SHIPPED order (preserves firstShippedAt,
     * records TRACKING_UPDATE event, and avoids re-sending email when tracking number is unchanged).
     */
    @Transactional
    public void adminUpdateTracking(String orderNumber, String carrier, String trackingNumber, String note, String operatorEmail) {
        if (carrier == null || carrier.isBlank() || trackingNumber == null || trackingNumber.isBlank()) {
            throw new IllegalArgumentException("Carrier and tracking number are required.");
        }
        String trimmedCarrier = carrier.trim();
        String trimmedTracking = trackingNumber.trim();

        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (!OrderStatus.SHIPPED.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("仅已发货订单可修改运单号（当前状态：" + order.getStatus() + "）。");
        }

        // Identical carrier & tracking -> pure idempotent no-op, zero duplicate email/event
        if (trimmedCarrier.equalsIgnoreCase(order.getCarrier())
                && trimmedTracking.equalsIgnoreCase(order.getTrackingNumber())) {
            return;
        }

        String prevCarrier = order.getCarrier();
        String prevTracking = order.getTrackingNumber();
        order.setCarrier(trimmedCarrier);
        order.setTrackingNumber(trimmedTracking);

        boolean shouldNotify = !trimmedTracking.equalsIgnoreCase(order.getShippingNotifiedTracking());
        boolean sent = false;
        if (shouldNotify) {
            try {
                emailService.sendShippingNotification(
                        order.getCustomerEmail(),
                        order.getOrderNumber(),
                        resolveProductName(order),
                        trimmedCarrier,
                        trimmedTracking
                );
                order.setShippingNotifiedTracking(trimmedTracking);
                sent = true;
            } catch (Exception e) {
                log.error("Failed to send updated shipping notification email for order {}", orderNumber, e);
            }
        }
        orderRepository.save(order);

        if (orderShipmentEventRepository != null) {
            OrderShipmentEvent evt = new OrderShipmentEvent();
            evt.setOrderNumber(order.getOrderNumber());
            evt.setEventType(OrderShipmentEvent.TYPE_TRACKING_UPDATE);
            evt.setCarrier(trimmedCarrier);
            evt.setTrackingNumber(trimmedTracking);
            evt.setPreviousCarrier(prevCarrier);
            evt.setPreviousTrackingNumber(prevTracking);
            evt.setNote(note != null && !note.isBlank() ? note.trim() : null);
            evt.setOperatorEmail(operatorEmail);
            evt.setNotificationSent(sent);
            evt.setCreatedAt(BusinessClock.now());
            orderShipmentEventRepository.save(evt);
        }
    }

    @Transactional
    public void adminDeliverOrder(String orderNumber) {
        adminDeliverOrder(orderNumber, null);
    }

    @Transactional
    public void adminDeliverOrder(String orderNumber, LocalDateTime actualDeliveredAt) {
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (!OrderStatus.SHIPPED.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("Only SHIPPED orders can be marked as DELIVERED.");
        }

        order.setStatus(OrderStatus.DELIVERED);
        order.setFulfillmentStatus(FulfillmentStatus.DELIVERED);
        order.setDeliveredAt(actualDeliveredAt != null ? actualDeliveredAt : BusinessClock.now());
        orderRepository.save(order);
    }

    @Transactional
    public String adminUpdateFulfillment(String orderNumber, String fulfillmentStatus, String note, LocalDate estimatedDeliveryDate) {
        return adminUpdateFulfillment(orderNumber, fulfillmentStatus, note, estimatedDeliveryDate, null, null, null, null, null);
    }

    /**
     * P0-04 hardened fulfillment update: enforces legal stage transitions, NEVER auto-stamps
     * opticianVerifiedAt when entering IN_PRODUCTION, and requires real QC PASSED before QC_PASSED.
     */
    @Transactional
    public String adminUpdateFulfillment(
            String orderNumber,
            String fulfillmentStatus,
            String note,
            LocalDate estimatedDeliveryDate,
            String deliveryDelayReason,
            Boolean opticianVerified,
            String qcStatus,
            String qcNote,
            String adminEmail) {
        if (!FulfillmentStatus.isValid(fulfillmentStatus)) {
            throw new IllegalArgumentException("Invalid fulfillment status: " + fulfillmentStatus);
        }
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (!OrderStatus.PAID.equalsIgnoreCase(order.getStatus())
                && !OrderStatus.SHIPPED.equalsIgnoreCase(order.getStatus())
                && !OrderStatus.DELIVERED.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("仅已付款订单可更新验配与履约进度。");
        }

        String previous = order.getFulfillmentStatus() != null ? order.getFulfillmentStatus() : FulfillmentStatus.PENDING_REVIEW;
        String normalizedTarget = fulfillmentStatus.trim().toUpperCase();

        if (FulfillmentStatus.SHIPPED.equals(normalizedTarget) || FulfillmentStatus.DELIVERED.equals(normalizedTarget)) {
            throw new IllegalStateException("出库发货与签收请使用专门的发货/签收操作，不可直接修改履约状态。");
        }

        // Record explicit optician verification ONLY when explicitly confirmed (NEVER auto-filled by IN_PRODUCTION)
        if (Boolean.TRUE.equals(opticianVerified)) {
            order.setOpticianVerifiedBy(adminEmail != null ? adminEmail : "optician");
            order.setOpticianVerifiedAt(BusinessClock.now());
            order.setOpticianVerifiedRxVersion(order.getPrescriptionVersion());
        }

        // Validate transition legality
        validateFulfillmentTransition(previous, normalizedTarget);

        // Entering IN_PRODUCTION or QC_PASSED requires optician verification of current rx version
        if (FulfillmentStatus.IN_PRODUCTION.equals(normalizedTarget)
                || FulfillmentStatus.QC_PASSED.equals(normalizedTarget)) {
            ensureOpticianVerifiedCurrentRx(order);
        }

        // Apply explicit QC status if supplied
        if (qcStatus != null && !qcStatus.isBlank()) {
            String normalizedQc = qcStatus.trim().toUpperCase();
            if (!List.of("PENDING", "PASSED", "FAILED").contains(normalizedQc)) {
                throw new IllegalArgumentException("Invalid QC status: " + qcStatus);
            }
            if ("PASSED".equals(normalizedQc) || "FAILED".equals(normalizedQc)) {
                if (!FulfillmentStatus.IN_PRODUCTION.equalsIgnoreCase(previous)
                        && !FulfillmentStatus.QC_PASSED.equalsIgnoreCase(previous)
                        && !FulfillmentStatus.IN_PRODUCTION.equals(normalizedTarget)) {
                    throw new IllegalStateException("订单须进入制作阶段（IN_PRODUCTION）后方可记录质检结论。");
                }
                order.setQcCheckedBy(adminEmail != null ? adminEmail : "qc");
                order.setQcCheckedAt(BusinessClock.now());
            }
            order.setQcStatus(normalizedQc);
        }

        if (FulfillmentStatus.QC_PASSED.equals(normalizedTarget)) {
            if (!"PASSED".equalsIgnoreCase(order.getQcStatus()) || order.getQcCheckedAt() == null) {
                throw new IllegalStateException("进入「质检通过 (QC_PASSED)」必须同时提交真实的质检通过结果（qcStatus=PASSED）。");
            }
        }
        // Moving back from QC_PASSED to IN_PRODUCTION (rework) invalidates prior QC pass
        if (FulfillmentStatus.QC_PASSED.equalsIgnoreCase(previous)
                && FulfillmentStatus.IN_PRODUCTION.equals(normalizedTarget)
                && (qcStatus == null || !"FAILED".equalsIgnoreCase(qcStatus))) {
            order.setQcStatus("PENDING");
            order.setQcCheckedAt(null);
        }

        order.setFulfillmentStatus(normalizedTarget);
        if (note != null) {
            order.setFulfillmentNote(note.trim().isEmpty() ? null : note.trim());
        }
        if (estimatedDeliveryDate != null) {
            if (order.getInitialPromisedDeliveryDate() == null) {
                order.setInitialPromisedDeliveryDate(
                        order.getEstimatedDeliveryDate() != null ? order.getEstimatedDeliveryDate() : estimatedDeliveryDate);
            }
            order.setEstimatedDeliveryDate(estimatedDeliveryDate);
        }
        if (deliveryDelayReason != null) {
            order.setDeliveryDelayReason(deliveryDelayReason.trim().isEmpty() ? null : deliveryDelayReason.trim());
        }
        if (qcNote != null) {
            order.setQcNote(qcNote.trim().isEmpty() ? null : qcNote.trim());
        }
        orderRepository.save(order);
        return previous;
    }

    private void ensureOpticianVerifiedCurrentRx(Order order) {
        if (order.getOpticianVerifiedAt() == null
                || (order.getOpticianVerifiedRxVersion() != null
                    && !Objects.equals(order.getOpticianVerifiedRxVersion(), order.getPrescriptionVersion()))) {
            throw new IllegalStateException("请先由验配师完成当前处方版本（v" + order.getPrescriptionVersion() + "）的验配确认后再继续。");
        }
    }

    private void validateFulfillmentTransition(String currentRaw, String targetRaw) {
        String current = (currentRaw != null && !currentRaw.isBlank())
                ? currentRaw.trim().toUpperCase()
                : FulfillmentStatus.PENDING_REVIEW;
        String target = targetRaw.trim().toUpperCase();
        Set<String> allowed = ALLOWED_FULFILLMENT_TRANSITIONS.getOrDefault(current, Set.of());
        if (!allowed.contains(target)) {
            throw new IllegalStateException("不允许的履约状态跳转：" + current + " -> " + target + "。请按验配确认→制作→质检→发货顺序操作。");
        }
    }

    @Transactional
    public OrderDetailResponseDTO adminUpdateOrderEconomics(
            String orderNumber,
            String orderSource,
            BigDecimal variableCostAmount,
            BigDecimal shippingCostAmount,
            BigDecimal paymentFeeAmount) {
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (orderSource != null) {
            order.setOrderSource(orderSource.trim().isEmpty() ? null : orderSource.trim().toUpperCase());
        }
        if (variableCostAmount != null) {
            if (variableCostAmount.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("变动成本不可为负数。");
            }
            order.setVariableCostAmount(variableCostAmount);
        }
        if (shippingCostAmount != null) {
            if (shippingCostAmount.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("物流成本不可为负数。");
            }
            order.setShippingCostAmount(shippingCostAmount);
        }
        if (paymentFeeAmount != null) {
            if (paymentFeeAmount.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("支付手续费不可为负数。");
            }
            order.setPaymentFeeAmount(paymentFeeAmount);
        }
        orderRepository.save(order);
        Order fresh = orderRepository.findByOrderNumber(orderNumber).orElse(order);
        return toOrderDetailResponseDTO(fresh, true);
    }

    @Transactional
    public OrderDetailResponseDTO adminUpdateOrderEconomics(
            String orderNumber,
            String orderSource,
            BigDecimal variableCostAmount) {
        return adminUpdateOrderEconomics(orderNumber, orderSource, variableCostAmount, null, null);
    }

    @Transactional
    public String adminUpdateShippingAddress(String orderNumber, String shippingAddress, String customerPhone) {
        return adminUpdateShippingAddress(orderNumber, shippingAddress, customerPhone, null, null, null, null);
    }

    @Transactional
    public String adminUpdateShippingAddress(
            String orderNumber,
            String shippingAddress,
            String customerPhone,
            String province,
            String city,
            String district,
            String detailAddress) {
        if ((shippingAddress == null || shippingAddress.isBlank()) && (detailAddress == null || detailAddress.isBlank())) {
            throw new IllegalArgumentException("Shipping address cannot be blank.");
        }
        Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                .or(() -> orderRepository.findByOrderNumber(orderNumber))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        if (OrderStatus.SHIPPED.equalsIgnoreCase(order.getStatus())
                || OrderStatus.DELIVERED.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("已发货或已签收订单无法直接修改地址，请通过承运商拦截或售后工单处理。");
        }

        String effectivePhone = (customerPhone != null && !customerPhone.isBlank())
                ? customerPhone.trim()
                : order.getCustomerPhone();
        String combinedInput = shippingAddress != null ? shippingAddress.trim() : "";

        if (deliveryPolicyService != null) {
            CustomerInfoDTO probe = new CustomerInfoDTO(
                    order.getCustomerFirstName() != null ? order.getCustomerFirstName() : "Customer",
                    order.getCustomerLastName(),
                    order.getCustomerEmail() != null ? order.getCustomerEmail() : "customer@klarheit.com",
                    combinedInput.isBlank() ? detailAddress : combinedInput,
                    effectivePhone,
                    province,
                    city,
                    district,
                    detailAddress
            );
            DeliveryPolicyService.DeliveryEstimate est = deliveryPolicyService.evaluate(probe, effectivePhone);
            if (!est.deliverable()) {
                throw new IllegalArgumentException(est.reason());
            }
            combinedInput = deliveryPolicyService.assembleAddress(probe);
            order.setShippingProvince(est.resolvedProvince());
            order.setShippingCity(est.resolvedCity() != null ? est.resolvedCity() : city);
            order.setShippingDistrict(district);
            order.setShippingDetailAddress(detailAddress);
        }

        String previous = order.getShippingAddress();
        order.setShippingAddress(combinedInput);
        if (customerPhone != null && !customerPhone.isBlank()) {
            order.setCustomerPhone(customerPhone.trim());
        }
        orderRepository.save(order);
        return previous;
    }

    @Transactional(readOnly = true)
    public Page<OrderSummaryDTO> getAllOrdersForAdmin(Pageable pageable) {
        return getAllOrdersForAdmin(null, null, null, false, pageable);
    }

    @Transactional(readOnly = true)
    public Page<OrderSummaryDTO> getAllOrdersForAdmin(String status, String fulfillmentStatus, String search, Pageable pageable) {
        return getAllOrdersForAdmin(status, fulfillmentStatus, search, false, pageable);
    }

    @Transactional(readOnly = true)
    public Page<OrderSummaryDTO> getAllOrdersForAdmin(String status, String fulfillmentStatus, String search, boolean overdueOnly, Pageable pageable) {
        if (overdueOnly) {
            LocalDateTime now = BusinessClock.now();
            return orderRepository.searchOverdueHoldOrdersForAdmin(
                    now,
                    now.minusMinutes(DEFAULT_PAYMENT_HOLD_MINUTES),
                    now.minusHours(DEFAULT_REVIEW_HOLD_HOURS),
                    now.minusHours(DEFAULT_QUOTE_HOLD_HOURS),
                    search != null && !search.isBlank() ? search.trim() : null,
                    pageable
            ).map(this::toOrderSummaryDTO);
        }
        boolean hasFilter = (status != null && !status.isBlank())
                || (fulfillmentStatus != null && !fulfillmentStatus.isBlank())
                || (search != null && !search.isBlank());
        Page<Order> page = hasFilter
                ? orderRepository.searchOrdersForAdmin(
                        status != null && !status.isBlank() ? status.trim() : null,
                        fulfillmentStatus != null && !fulfillmentStatus.isBlank() ? fulfillmentStatus.trim() : null,
                        search != null && !search.isBlank() ? search.trim() : null,
                        pageable)
                : orderRepository.findAll(pageable);

        return page.map(this::toOrderSummaryDTO);
    }

    @Transactional(readOnly = true)
    public OrderDetailResponseDTO getOrderDetailsForAdmin(String orderNumber) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));
        return toOrderDetailResponseDTO(order, true);
    }

    @Transactional(readOnly = true)
    public List<OrderSummaryDTO> getMyOrders(String authenticatedEmail) {
        UserAccount user = userService.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::toOrderSummaryDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<OrderSummaryDTO> getMyOrdersPaged(String authenticatedEmail, Pageable pageable) {
        UserAccount user = userService.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), pageable)
                .map(this::toOrderSummaryDTO);
    }

    private OrderSummaryDTO toOrderSummaryDTO(Order order) {
        return new OrderSummaryDTO(
                order.getOrderNumber(),
                order.getStatus(),
                order.getTotalAmount(),
                resolveProductName(order),
                order.getLensOptionTypes(),
                order.getCreatedAt(),
                order.getFulfillmentStatus() != null ? order.getFulfillmentStatus() : FulfillmentStatus.PENDING_REVIEW
        );
    }

    private String resolveProductName(Order order) {
        if (order.getProductNameSnapshot() != null && !order.getProductNameSnapshot().isBlank()) {
            return order.getProductNameSnapshot();
        }
        return order.getProduct() != null && order.getProduct().getName() != null
                ? order.getProduct().getName()
                : "";
    }

    private void ensureOwnerOrStaff(Order order, UserAccount user) {
        boolean isStaff = StaffRoles.isStaffRole(user.getRole());
        boolean isOwner = (order.getUserId() != null && order.getUserId().equals(user.getId()))
                || (order.getCustomerEmail() != null && order.getCustomerEmail().equalsIgnoreCase(user.getEmail()));
        if (!isStaff && !isOwner) {
            throw new IllegalArgumentException("Unauthorized to view this order.");
        }
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
        return "KL-" + BusinessClock.now().format(ORDER_NUMBER_FORMAT) + "-"
                + ThreadLocalRandom.current().nextInt(100000, 1000000);
    }

    @Transactional(readOnly = true)
    public String getOrderStatusOnly(String orderNumber) {
        return orderRepository.findByOrderNumber(orderNumber)
                .map(Order::getStatus)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));
    }

    @Transactional(readOnly = true)
    public OrderDetailResponseDTO getOrderDetails(String orderNumber, String email) {
        UserAccount user = userService.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        ensureOwnerOrStaff(order, user);
        return toOrderDetailResponseDTO(order, StaffRoles.isStaffRole(user.getRole()));
    }

    private OrderDetailResponseDTO toOrderDetailResponseDTO(Order order, boolean includeInternalFields) {
        List<OrderLensSnapshot> snapshot = order.getLensOptionsSnapshot();
        List<OrderDetailResponseDTO.LensOptionDetailDTO> lensOptionDetails = (snapshot == null || snapshot.isEmpty())
                ? order.getLensOptions().stream()
                        .map(lo -> new OrderDetailResponseDTO.LensOptionDetailDTO(
                                lo.getType(), lo.getLabel(), lo.getAdditionalPrice()))
                        .toList()
                : snapshot.stream()
                        .map(item -> new OrderDetailResponseDTO.LensOptionDetailDTO(
                                item.type(), item.label(), item.additionalPrice()))
                        .toList();

        Prescription p = order.getPrescription();
        PrescriptionDetailsDTO prescriptionDetails = p == null ? null : new PrescriptionDetailsDTO(
                p.getSphOd(), p.getSphOs(), p.getCylOd(), p.getCylOs(), p.getAxisOd(), p.getAxisOs(), p.getPd()
        );

        String productName = order.getProductNameSnapshot() != null
                ? order.getProductNameSnapshot()
                : order.getProduct() != null ? order.getProduct().getName() : null;
        String productImageUrl = order.getProductImageUrlSnapshot() != null
                ? order.getProductImageUrlSnapshot()
                : order.getProduct() != null ? order.getProduct().getImageUrl() : null;

        List<OrderDetailResponseDTO.QuoteVersionSummaryDTO> quoteHistory = orderQuoteVersionRepository != null
                ? orderQuoteVersionRepository.findByOrderNumberOrderByVersionNumberDesc(order.getOrderNumber()).stream()
                        .map(qv -> new OrderDetailResponseDTO.QuoteVersionSummaryDTO(
                                qv.getVersionNumber(),
                                qv.getSkuId(),
                                qv.getFinishId(),
                                qv.getSizeSpec(),
                                qv.getLensOptionsSnapshot() == null ? List.of()
                                        : qv.getLensOptionsSnapshot().stream()
                                                .map(l -> new OrderDetailResponseDTO.LensOptionDetailDTO(l.type(), l.label(), l.additionalPrice()))
                                                .toList(),
                                qv.getQuotedAmount(),
                                qv.getPromisedDeliveryDate(),
                                qv.getExpiresAt(),
                                qv.getQuoteNote(),
                                qv.getChangeSummary(),
                                qv.getCreatedAt(),
                                qv.getConfirmedAt()
                        ))
                        .toList()
                : List.of();

        List<OrderDetailResponseDTO.RefundTransactionDTO> refundTxDtos = refundTransactionRepository != null
                ? refundTransactionRepository.findByOrderNumberOrderByRequestedAtAsc(order.getOrderNumber()).stream()
                        .map(tx -> new OrderDetailResponseDTO.RefundTransactionDTO(
                                tx.getRefundRequestId(),
                                tx.getTicketNumber(),
                                tx.getRequestedAmount(),
                                tx.getConfirmedAmount(),
                                tx.getStatus(),
                                tx.getPaymentChannel(),
                                tx.getGatewayRefundId(),
                                tx.getManualVoucherRef(),
                                tx.getReason(),
                                includeInternalFields ? tx.getFailureMessage() : null,
                                tx.getRequestedAt(),
                                tx.getConfirmedAt(),
                                includeInternalFields ? tx.getFinanceVerifiedBy() : null,
                                tx.getFinanceVerifiedAt()
                        ))
                        .toList()
                : List.of();

        List<OrderDetailResponseDTO.ShipmentEventDTO> shipmentEventDtos = orderShipmentEventRepository != null
                ? orderShipmentEventRepository.findByOrderNumberOrderByCreatedAtAsc(order.getOrderNumber()).stream()
                        .map(ev -> new OrderDetailResponseDTO.ShipmentEventDTO(
                                ev.getEventType(),
                                ev.getCarrier(),
                                ev.getTrackingNumber(),
                                ev.getPreviousCarrier(),
                                ev.getPreviousTrackingNumber(),
                                includeInternalFields ? ev.getNote() : null,
                                ev.getCreatedAt()
                        ))
                        .toList()
                : List.of();

        // P0-10: Strip internal operator emails, internal costs, orderSource, internal QC notes from customer responses
        return new OrderDetailResponseDTO(
                order.getOrderNumber(),
                order.getStatus(),
                order.getTotalAmount(),
                order.getDiscountAmount(),
                order.getAppliedCouponCode(),
                order.getCreatedAt(),
                order.getPaidAt(),
                order.getCustomerFirstName(),
                order.getCustomerLastName(),
                order.getCustomerEmail(),
                order.getCustomerPhone(),
                order.getShippingAddress(),
                order.getPaymentChannel(),
                order.getGatewayTransactionId(),
                order.getFinishId(),
                productName,
                productImageUrl,
                lensOptionDetails,
                prescriptionDetails,
                order.getCarrier(),
                order.getTrackingNumber(),
                order.getFulfillmentStatus() != null ? order.getFulfillmentStatus() : FulfillmentStatus.PENDING_REVIEW,
                order.getFulfillmentNote(),
                order.getEstimatedDeliveryDate(),
                order.getDeliveredAt(),
                order.getWearerName(),
                order.getConfirmedRefundAmount().compareTo(BigDecimal.ZERO) > 0
                        ? order.getConfirmedRefundAmount()
                        : order.getRefundAmount(),
                order.getRefundReason(),
                order.getSkuId(),
                order.getSizeSpecSnapshot(),
                order.getInitialPromisedDeliveryDate() != null
                        ? order.getInitialPromisedDeliveryDate()
                        : order.getEstimatedDeliveryDate(),
                order.getDeliveryDelayReason(),
                order.isRequiresPrepayReview(),
                order.getPrepayReviewReason(),
                order.getQuoteNote(),
                order.getQuoteRevisedAmount(),
                order.getCustomerQuoteConfirmedAt(),
                includeInternalFields ? order.getOpticianVerifiedBy() : null,
                order.getOpticianVerifiedAt(),
                order.getQcStatus(),
                includeInternalFields ? order.getQcNote() : null,
                includeInternalFields ? order.getQcCheckedBy() : null,
                order.getQcCheckedAt(),
                includeInternalFields ? order.getOrderSource() : null,
                includeInternalFields ? order.getVariableCostAmount() : null,
                order.getParentOrderNumber(),
                order.getQuoteVersion(),
                order.getQuoteExpiresAt(),
                order.getReviewExpiresAt(),
                order.getQuoteChangeSummary(),
                order.getPrescriptionVersion(),
                includeInternalFields ? order.getOpticianVerifiedRxVersion() : null,
                order.getFirstShippedAt(),
                order.getShippingProvince(),
                order.getShippingCity(),
                order.getShippingDistrict(),
                order.getShippingDetailAddress(),
                order.getShippingFee(),
                order.isDeliveryReviewRequired(),
                includeInternalFields ? order.getInitialPromisedSource() : null,
                order.getConfirmedRefundAmount(),
                order.getPendingRefundAmount(),
                includeInternalFields ? order.isReturnRestocked() : null,
                includeInternalFields ? order.getReturnRestockedByTicket() : null,
                quoteHistory,
                refundTxDtos,
                shipmentEventDtos
        );
    }
}
