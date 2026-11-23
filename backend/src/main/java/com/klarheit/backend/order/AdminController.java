package com.klarheit.backend.order;

import com.klarheit.backend.aftersales.AfterSalesTicket;
import com.klarheit.backend.aftersales.AfterSalesTicketRepository;
import com.klarheit.backend.audit.AuditLog;
import com.klarheit.backend.audit.AuditLogRepository;
import com.klarheit.backend.audit.AuditLogService;
import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.auth.dto.UserProfileDTO;
import com.klarheit.backend.coupon.CouponService;
import com.klarheit.backend.email.EmailNotificationLog;
import com.klarheit.backend.email.EmailService;
import com.klarheit.backend.order.dto.OrderDetailResponseDTO;
import com.klarheit.backend.order.dto.OrderSummaryDTO;
import com.klarheit.backend.order.dto.PrescriptionDetailsDTO;
import com.klarheit.backend.payment.RefundStatus;
import com.klarheit.backend.payment.RefundTransaction;
import com.klarheit.backend.payment.RefundTransactionRepository;
import com.klarheit.backend.prescription.Prescription;
import com.klarheit.backend.product.ProductService;
import com.klarheit.backend.product.dto.ProductRequestDTO;
import com.klarheit.backend.product.dto.ProductResponseDTO;
import com.klarheit.backend.product.dto.ProductSkuDTO;
import com.klarheit.backend.product.dto.ProductSkuUpsertDTO;
import com.klarheit.backend.product.dto.StocktakeItemDTO;
import com.klarheit.backend.security.StaffRoles;
import com.klarheit.backend.settings.SystemSettingService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
    private static final String TARGET_ORDER = "ORDER";
    private static final String TARGET_PRODUCT = "PRODUCT";
    private static final String TARGET_SETTING = "SYSTEM_SETTING";
    private static final String TARGET_USER = "USER";
    private static final String TARGET_NOTIFICATION = "NOTIFICATION";

    private final OrderRepository orderRepository;
    private final UserAccountRepository userAccountRepository;
    private final ProductService productService;
    private final AuditLogService auditLogService;
    private final OrderService orderService;
    private final CouponService couponService;

    @Autowired(required = false)
    private SystemSettingService systemSettingService;

    @Autowired(required = false)
    private AuditLogRepository auditLogRepository;

    @Autowired(required = false)
    private AfterSalesTicketRepository afterSalesTicketRepository;

    @Autowired(required = false)
    private RefundTransactionRepository refundTransactionRepository;

    @Autowired(required = false)
    private EmailService emailService;

    public AdminController(OrderRepository orderRepository,
                           UserAccountRepository userAccountRepository,
                           ProductService productService,
                           AuditLogService auditLogService) {
        this(orderRepository, userAccountRepository, productService, auditLogService, null, null);
    }

    @Autowired
    public AdminController(OrderRepository orderRepository,
                           UserAccountRepository userAccountRepository,
                           ProductService productService,
                           AuditLogService auditLogService,
                           OrderService orderService,
                           CouponService couponService) {
        this.orderRepository = orderRepository;
        this.userAccountRepository = userAccountRepository;
        this.productService = productService;
        this.auditLogService = auditLogService;
        this.orderService = orderService;
        this.couponService = couponService;
    }

    public void setRefundTransactionRepository(RefundTransactionRepository refundTransactionRepository) {
        this.refundTransactionRepository = refundTransactionRepository;
    }

    public void setAfterSalesTicketRepository(AfterSalesTicketRepository afterSalesTicketRepository) {
        this.afterSalesTicketRepository = afterSalesTicketRepository;
    }

    public void setEmailService(EmailService emailService) {
        this.emailService = emailService;
    }

    public ResponseEntity<Page<OrderSummaryDTO>> getAllOrders(Pageable pageable) {
        return getAllOrders(null, null, null, false, pageable);
    }

    @GetMapping("/orders")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<OrderSummaryDTO>> getAllOrders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String fulfillmentStatus,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "false") boolean overdueOnly,
            @PageableDefault(size = 20) Pageable pageable) {
        if (orderService != null) {
            return ResponseEntity.ok(orderService.getAllOrdersForAdmin(status, fulfillmentStatus, search, overdueOnly, pageable));
        }
        Page<OrderSummaryDTO> orders = orderRepository.findAll(pageable)
                .map(order -> new OrderSummaryDTO(
                        order.getOrderNumber(),
                        order.getStatus(),
                        order.getTotalAmount(),
                        order.getProductNameSnapshot() != null
                                ? order.getProductNameSnapshot()
                                : (order.getProduct() != null ? order.getProduct().getName() : ""),
                        order.getLensOptionTypes(),
                        order.getCreatedAt(),
                        order.getFulfillmentStatus() != null ? order.getFulfillmentStatus() : FulfillmentStatus.PENDING_REVIEW
                ));
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/orders/{orderNumber}")
    @Transactional(readOnly = true)
    public ResponseEntity<OrderDetailResponseDTO> getOrderDetails(@PathVariable String orderNumber) {
        if (orderService != null) {
            return ResponseEntity.ok(orderService.getOrderDetailsForAdmin(orderNumber));
        }
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));
        List<OrderDetailResponseDTO.LensOptionDetailDTO> lensOptionDetails = order.getLensOptionsSnapshot().stream()
                .map(snapshot -> new OrderDetailResponseDTO.LensOptionDetailDTO(
                        snapshot.type(), snapshot.label(), snapshot.additionalPrice()))
                .toList();
        Prescription p = order.getPrescription();
        PrescriptionDetailsDTO prescriptionDetails = p == null ? null : new PrescriptionDetailsDTO(
                p.getSphOd(), p.getSphOs(), p.getCylOd(), p.getCylOs(), p.getAxisOd(), p.getAxisOs(), p.getPd()
        );
        return ResponseEntity.ok(new OrderDetailResponseDTO(
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
                order.getProductNameSnapshot(),
                order.getProductImageUrlSnapshot(),
                lensOptionDetails,
                prescriptionDetails,
                order.getCarrier(),
                order.getTrackingNumber(),
                order.getFulfillmentStatus() != null ? order.getFulfillmentStatus() : FulfillmentStatus.PENDING_REVIEW,
                order.getFulfillmentNote(),
                order.getEstimatedDeliveryDate(),
                order.getDeliveredAt(),
                order.getWearerName(),
                order.getRefundAmount(),
                order.getRefundReason()
        ));
    }

    // ── P0-04 Explicit Optician, Production, QC, Shipment & Tracking Endpoints ──

    @PostMapping("/orders/{orderNumber}/verify-optician")
    @Transactional
    public ResponseEntity<OrderDetailResponseDTO> verifyOptician(
            @PathVariable String orderNumber,
            @RequestBody(required = false) Map<String, String> request,
            Authentication authentication) {
        String note = request != null ? request.get("note") : null;
        String email = authentication != null ? authentication.getName() : "optician";
        OrderDetailResponseDTO updated = orderService.adminVerifyOpticianPrescription(orderNumber, note, email);
        auditLogService.log(email, "VERIFY_OPTICIAN", TARGET_ORDER, orderNumber,
                "rxVersion=" + updated.prescriptionVersion() + (note != null ? "; note=" + note : ""));
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/orders/{orderNumber}/prescription")
    @Transactional
    public ResponseEntity<OrderDetailResponseDTO> reviseOrderPrescription(
            @PathVariable String orderNumber,
            @Valid @RequestBody PrescriptionDetailsDTO prescription,
            @RequestParam(required = false) String note,
            Authentication authentication) {
        String email = authentication != null ? authentication.getName() : "optician";
        OrderDetailResponseDTO updated = orderService.adminReviseOrderPrescription(orderNumber, prescription, note, email);
        auditLogService.log(email, "REVISE_PRESCRIPTION", TARGET_ORDER, orderNumber,
                "rxVersion=" + updated.prescriptionVersion() + "; verificationReset=true");
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/orders/{orderNumber}/start-production")
    @Transactional
    public ResponseEntity<OrderDetailResponseDTO> startProduction(
            @PathVariable String orderNumber,
            @RequestBody(required = false) Map<String, String> request,
            Authentication authentication) {
        String estDateRaw = request != null ? request.get("estimatedDeliveryDate") : null;
        LocalDate estDate = (estDateRaw != null && !estDateRaw.isBlank()) ? LocalDate.parse(estDateRaw.trim()) : null;
        String note = request != null ? request.get("note") : null;
        String email = authentication != null ? authentication.getName() : "optician";
        OrderDetailResponseDTO updated = orderService.adminStartProduction(orderNumber, estDate, note, email);
        auditLogService.log(email, "START_PRODUCTION", TARGET_ORDER, orderNumber,
                "fulfillment=IN_PRODUCTION" + (estDate != null ? "; est=" + estDate : ""));
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/orders/{orderNumber}/qc")
    @Transactional
    public ResponseEntity<OrderDetailResponseDTO> recordQcResult(
            @PathVariable String orderNumber,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        String qcStatus = request.get("qcStatus");
        String qcNote = request.get("qcNote");
        String email = authentication != null ? authentication.getName() : "warehouse";
        OrderDetailResponseDTO updated = orderService.adminRecordQcResult(orderNumber, qcStatus, qcNote, email);
        auditLogService.log(email, "RECORD_QC", TARGET_ORDER, orderNumber,
                "qc=" + updated.qcStatus() + "; fulfillment=" + updated.fulfillmentStatus());
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/orders/{orderNumber}/fulfillment")
    @Transactional
    public ResponseEntity<Void> updateFulfillment(
            @PathVariable String orderNumber,
            @RequestBody Map<String, Object> request,
            Authentication authentication) {
        String fulfillmentStatus = request.get("fulfillmentStatus") != null ? String.valueOf(request.get("fulfillmentStatus")) : null;
        String note = request.get("fulfillmentNote") != null ? String.valueOf(request.get("fulfillmentNote")) : null;
        String estDateRaw = request.get("estimatedDeliveryDate") != null ? String.valueOf(request.get("estimatedDeliveryDate")) : null;
        LocalDate estDate = (estDateRaw != null && !estDateRaw.isBlank()) ? LocalDate.parse(estDateRaw.trim()) : null;
        String delayReason = request.get("deliveryDelayReason") != null ? String.valueOf(request.get("deliveryDelayReason")) : null;
        Boolean opticianVerified = request.get("opticianVerified") != null
                ? Boolean.valueOf(String.valueOf(request.get("opticianVerified")))
                : null;
        String qcStatus = request.get("qcStatus") != null ? String.valueOf(request.get("qcStatus")) : null;
        String qcNote = request.get("qcNote") != null ? String.valueOf(request.get("qcNote")) : null;
        String adminEmail = authentication != null ? authentication.getName() : "admin";

        String previous = orderService.adminUpdateFulfillment(
                orderNumber, fulfillmentStatus, note, estDate,
                delayReason, opticianVerified, qcStatus, qcNote, adminEmail);
        auditLogService.log(adminEmail, "UPDATE_FULFILLMENT", TARGET_ORDER, orderNumber,
                "fulfillment=" + previous + "->" + fulfillmentStatus
                        + (qcStatus != null && !qcStatus.isBlank() ? "; qc=" + qcStatus : "")
                        + (delayReason != null && !delayReason.isBlank() ? "; delay=" + delayReason : "")
                        + "; note=" + (note != null ? note : ""));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/orders/{orderNumber}/quote-confirm")
    @Transactional
    @SuppressWarnings("unchecked")
    public ResponseEntity<OrderDetailResponseDTO> confirmPrepayQuote(
            @PathVariable String orderNumber,
            @RequestBody Map<String, Object> request,
            Authentication authentication) {
        Object amtRaw = request.get("revisedTotalAmount");
        BigDecimal revisedAmount = (amtRaw != null && !String.valueOf(amtRaw).isBlank())
                ? new BigDecimal(String.valueOf(amtRaw).trim())
                : null;
        String dateRaw = request.get("estimatedDeliveryDate") != null
                ? String.valueOf(request.get("estimatedDeliveryDate")) : null;
        LocalDate promisedDate = (dateRaw != null && !dateRaw.isBlank()) ? LocalDate.parse(dateRaw.trim()) : null;
        String quoteNote = request.get("quoteNote") != null ? String.valueOf(request.get("quoteNote")) : null;
        Long targetSkuId = request.get("targetSkuId") != null && !String.valueOf(request.get("targetSkuId")).isBlank()
                ? Long.valueOf(String.valueOf(request.get("targetSkuId")).trim())
                : null;
        String targetFinishId = request.get("targetFinishId") != null ? String.valueOf(request.get("targetFinishId")) : null;
        String targetSizeSpec = request.get("targetSizeSpec") != null ? String.valueOf(request.get("targetSizeSpec")) : null;
        List<String> revisedLenses = null;
        if (request.get("revisedLensOptionTypes") instanceof List<?> rawList) {
            revisedLenses = rawList.stream().map(String::valueOf).toList();
        }
        String expiresRaw = request.get("quoteExpiresAt") != null ? String.valueOf(request.get("quoteExpiresAt")) : null;
        LocalDateTime expiresAt = (expiresRaw != null && !expiresRaw.isBlank()) ? LocalDateTime.parse(expiresRaw.trim()) : null;
        String changeSummary = request.get("changeSummary") != null ? String.valueOf(request.get("changeSummary")) : null;
        String adminEmail = authentication != null ? authentication.getName() : "optician";

        OrderDetailResponseDTO updated = orderService.adminConfirmPrepayQuote(
                orderNumber, revisedAmount, promisedDate, quoteNote, adminEmail,
                targetSkuId, targetFinishId, targetSizeSpec, revisedLenses, expiresAt, changeSummary);
        auditLogService.log(adminEmail, "CONFIRM_PREPAY_QUOTE", TARGET_ORDER, orderNumber,
                "v=" + updated.quoteVersion() + "; revisedAmount=" + updated.quoteRevisedAmount()
                        + "; promisedDate=" + updated.estimatedDeliveryDate()
                        + (updated.quoteChangeSummary() != null ? "; diff=" + updated.quoteChangeSummary() : ""));
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/orders/{orderNumber}/economics")
    @Transactional
    public ResponseEntity<OrderDetailResponseDTO> updateOrderEconomics(
            @PathVariable String orderNumber,
            @RequestBody Map<String, Object> request,
            Authentication authentication) {
        String source = request.get("orderSource") != null ? String.valueOf(request.get("orderSource")) : null;
        BigDecimal cost = parseOptionalDecimal(request.get("variableCostAmount"));
        BigDecimal shippingCost = parseOptionalDecimal(request.get("shippingCostAmount"));
        BigDecimal paymentFee = parseOptionalDecimal(request.get("paymentFeeAmount"));
        String adminEmail = authentication != null ? authentication.getName() : "finance";

        OrderDetailResponseDTO updated = orderService.adminUpdateOrderEconomics(
                orderNumber, source, cost, shippingCost, paymentFee);
        auditLogService.log(adminEmail, "UPDATE_ORDER_ECONOMICS", TARGET_ORDER, orderNumber,
                "source=" + updated.orderSource() + "; variableCost=" + updated.variableCostAmount());
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/orders/{orderNumber}/ship")
    @Transactional
    public ResponseEntity<Void> shipOrder(
            @PathVariable String orderNumber,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        String carrier = request.get("carrier");
        String trackingNumber = request.get("trackingNumber");
        String operator = authentication != null ? authentication.getName() : "warehouse";
        if (orderService != null) {
            orderService.adminShipOrder(orderNumber, carrier, trackingNumber, operator);
        } else {
            if (carrier == null || carrier.isBlank() || trackingNumber == null || trackingNumber.isBlank()) {
                throw new IllegalArgumentException("Carrier and tracking number are required.");
            }
            Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                    .or(() -> orderRepository.findByOrderNumber(orderNumber))
                    .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));
            if (!OrderStatus.PAID.equalsIgnoreCase(order.getStatus()) && !OrderStatus.SHIPPED.equalsIgnoreCase(order.getStatus())) {
                throw new IllegalArgumentException("Only PAID orders can be shipped.");
            }
            order.setStatus(OrderStatus.SHIPPED);
            order.setFulfillmentStatus(FulfillmentStatus.SHIPPED);
            order.setCarrier(carrier.trim());
            order.setTrackingNumber(trackingNumber.trim());
            orderRepository.save(order);
        }

        auditLogService.log(operator, "SHIP_ORDER", TARGET_ORDER, orderNumber,
                "carrier=" + carrier.trim() + "; trackingNumber=" + trackingNumber.trim());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/orders/{orderNumber}/tracking")
    @Transactional
    public ResponseEntity<Void> updateTracking(
            @PathVariable String orderNumber,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        String carrier = request.get("carrier");
        String trackingNumber = request.get("trackingNumber");
        String note = request.get("note");
        String operator = authentication != null ? authentication.getName() : "warehouse";
        orderService.adminUpdateTracking(orderNumber, carrier, trackingNumber, note, operator);
        auditLogService.log(operator, "UPDATE_TRACKING", TARGET_ORDER, orderNumber,
                "carrier=" + (carrier != null ? carrier.trim() : "")
                        + "; trackingNumber=" + (trackingNumber != null ? trackingNumber.trim() : ""));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/orders/{orderNumber}/deliver")
    @Transactional
    public ResponseEntity<Void> deliverOrder(
            @PathVariable String orderNumber,
            @RequestBody(required = false) Map<String, String> request,
            Authentication authentication) {
        LocalDateTime actualDeliveredAt = null;
        if (request != null && request.get("deliveredAt") != null && !request.get("deliveredAt").isBlank()) {
            actualDeliveredAt = LocalDateTime.parse(request.get("deliveredAt").trim());
        }
        orderService.adminDeliverOrder(orderNumber, actualDeliveredAt);
        auditLogService.log(authentication.getName(), "DELIVER_ORDER", TARGET_ORDER, orderNumber,
                "marked DELIVERED" + (actualDeliveredAt != null ? "; deliveredAt=" + actualDeliveredAt : ""));
        return ResponseEntity.ok().build();
    }

    @PutMapping("/orders/{orderNumber}/shipping-address")
    @Transactional
    public ResponseEntity<Void> updateOrderAddress(
            @PathVariable String orderNumber,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        String shippingAddress = request.get("shippingAddress");
        String customerPhone = request.get("customerPhone");
        String province = request.get("province");
        String city = request.get("city");
        String district = request.get("district");
        String detailAddress = request.get("detailAddress");
        String previousAddress = orderService.adminUpdateShippingAddress(
                orderNumber, shippingAddress, customerPhone, province, city, district, detailAddress);
        // P0-10: Mask street/building PII in general audit log entries
        auditLogService.log(authentication.getName(), "UPDATE_ORDER_ADDRESS", TARGET_ORDER, orderNumber,
                "before=" + maskAddressForAudit(previousAddress)
                        + "; after=" + maskAddressForAudit(shippingAddress != null ? shippingAddress : detailAddress)
                        + (customerPhone != null && !customerPhone.isBlank() ? "; phoneUpdated=true" : ""));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/orders/{orderNumber}/cancel")
    @Transactional(noRollbackFor = OrderCancellationDeferredException.class)
    public ResponseEntity<Void> cancelOrder(@PathVariable String orderNumber, Authentication authentication) {
        String adminEmail = authentication != null ? authentication.getName() : "unknown";
        String previousStatus;
        try {
            if (orderService != null) {
                previousStatus = orderService.adminCancelOrder(orderNumber);
            } else {
                Order order = orderRepository.findByOrderNumberWithWriteLock(orderNumber)
                        .or(() -> orderRepository.findByOrderNumber(orderNumber))
                        .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

                previousStatus = order.getStatus();
                if (OrderStatus.SHIPPED.equalsIgnoreCase(previousStatus)
                        || OrderStatus.DELIVERED.equalsIgnoreCase(previousStatus)) {
                    throw new IllegalStateException("Cannot cancel an order that has already been shipped or delivered.");
                }
                if (!OrderStatus.CANCELLED.equalsIgnoreCase(previousStatus)
                        && !OrderStatus.REFUND_PENDING.equalsIgnoreCase(previousStatus)
                        && !OrderStatus.REFUNDED.equalsIgnoreCase(previousStatus)) {
                    if (OrderStatus.PAID.equalsIgnoreCase(previousStatus)) {
                        order.setStatus(OrderStatus.REFUND_PENDING);
                    } else {
                        order.setStatus(OrderStatus.CANCELLED);
                    }
                    if (!order.isCouponReleased()
                            && order.getAppliedCouponCode() != null
                            && !order.getAppliedCouponCode().isBlank()
                            && couponService != null) {
                        couponService.decrementCouponUsage(order.getAppliedCouponCode());
                        order.setCouponReleased(true);
                    }
                    orderRepository.save(order);
                }
            }
        } catch (RuntimeException ex) {
            auditLogService.log(adminEmail, "CANCEL_ORDER_FAILED", TARGET_ORDER, orderNumber,
                    "reason=" + ex.getMessage());
            throw ex;
        }

        auditLogService.log(adminEmail, "CANCEL_ORDER", TARGET_ORDER, orderNumber,
                "previousStatus=" + previousStatus);
        return ResponseEntity.ok().build();
    }

    // ── P0-08 Period-Accurate Financial Dashboard & Reconciliation Export ──

    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        return getDashboardStats(null, null);
    }

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getDashboardStats(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        LocalDate fromDate = (from != null && !from.isBlank()) ? LocalDate.parse(from.trim()) : null;
        LocalDate toDate = (to != null && !to.isBlank()) ? LocalDate.parse(to.trim()) : null;

        long totalOrders = orderRepository.count();
        long totalUsers = userAccountRepository.count();

        boolean periodScoped = fromDate != null || toDate != null;
        List<Order> allOrders;
        List<AfterSalesTicket> allTickets;
        List<RefundTransaction> allRefundTxs;

        if (periodScoped) {
            LocalDateTime fromInclusive = fromDate != null ? fromDate.atStartOfDay() : null;
            LocalDateTime toExclusive = toDate != null ? toDate.plusDays(1).atStartOfDay() : null;
            List<Order> periodPaidOrders = safeList(orderRepository.findPaidOrdersInPeriod(fromInclusive, toExclusive));
            List<RefundTransaction> periodConfirmedRefunds = refundTransactionRepository != null
                    ? safeList(refundTransactionRepository.findConfirmedRefundsInPeriod(fromInclusive, toExclusive))
                    : List.of();
            List<RefundTransaction> unresolvedRefunds = refundTransactionRepository != null
                    ? safeList(refundTransactionRepository.findByStatusIn(List.of(
                            RefundStatus.REQUESTED, RefundStatus.PENDING_CHANNEL, RefundStatus.FAILED)))
                    : List.of();

            Map<String, Order> orderMap = new LinkedHashMap<>();
            for (Order o : periodPaidOrders) {
                if (o.getOrderNumber() != null) orderMap.put(o.getOrderNumber(), o);
            }
            Set<String> missingOrderNumbers = new HashSet<>();
            for (RefundTransaction tx : periodConfirmedRefunds) {
                if (tx.getOrderNumber() != null && !orderMap.containsKey(tx.getOrderNumber())) {
                    missingOrderNumbers.add(tx.getOrderNumber());
                }
            }
            if (!missingOrderNumbers.isEmpty()) {
                for (Order extra : safeList(orderRepository.findByOrderNumberIn(missingOrderNumbers))) {
                    if (extra.getOrderNumber() != null) orderMap.putIfAbsent(extra.getOrderNumber(), extra);
                }
            }
            // Also include live active-queue orders via indexed status lookup (never scans historical DELIVERED/CANCELLED rows)
            for (String activeStatus : List.of(
                    OrderStatus.AWAITING_REVIEW, OrderStatus.QUOTE_READY,
                    OrderStatus.CREATED, OrderStatus.PENDING_PAYMENT,
                    OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.REFUND_PENDING)) {
                for (Order active : safeList(orderRepository.findByStatus(activeStatus))) {
                    if (active.getOrderNumber() != null) orderMap.putIfAbsent(active.getOrderNumber(), active);
                }
            }
            allOrders = new ArrayList<>(orderMap.values());

            Map<String, RefundTransaction> txById = new LinkedHashMap<>();
            for (RefundTransaction tx : periodConfirmedRefunds) {
                txById.put(tx.getRefundRequestId() != null ? tx.getRefundRequestId() : String.valueOf(System.identityHashCode(tx)), tx);
            }
            for (RefundTransaction tx : unresolvedRefunds) {
                txById.putIfAbsent(tx.getRefundRequestId() != null ? tx.getRefundRequestId() : String.valueOf(System.identityHashCode(tx)), tx);
            }
            allRefundTxs = new ArrayList<>(txById.values());

            allTickets = (afterSalesTicketRepository != null && !orderMap.isEmpty())
                    ? safeList(afterSalesTicketRepository.findByOrderNumberIn(orderMap.keySet()))
                    : List.of();
        } else {
            allOrders = safeList(orderRepository.findAll());
            allTickets = afterSalesTicketRepository != null
                    ? safeList(afterSalesTicketRepository.findAll())
                    : List.of();
            allRefundTxs = refundTransactionRepository != null
                    ? safeList(refundTransactionRepository.findAll())
                    : List.of();
        }

        Map<String, List<RefundTransaction>> refundsByOrder = allRefundTxs.stream()
                .collect(Collectors.groupingBy(RefundTransaction::getOrderNumber));
        Map<String, List<AfterSalesTicket>> ticketsByOrder = allTickets.stream()
                .collect(Collectors.groupingBy(AfterSalesTicket::getOrderNumber));

        // 1. P0-08 Gross Receipts: include ALL actually paid orders (including later REFUNDED/REFUND_PENDING!),
        //    strictly filtered by actual paidAt date in [fromDate, toDate] when period is specified.
        List<Order> actuallyPaidOrdersInPeriod = allOrders.stream()
                .filter(o -> isOrderActuallyPaid(o) && isDateInPeriod(resolvePaidDate(o), fromDate, toDate))
                .toList();

        BigDecimal totalSales = actuallyPaidOrdersInPeriod.stream()
                .map(o -> o.getTotalAmount() != null ? o.getTotalAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 2. P0-08 Confirmed Refunds vs Pending Refunds, attributed by actual confirmedAt timestamp!
        BigDecimal totalRefunded = BigDecimal.ZERO;
        BigDecimal pendingRefundAmount = BigDecimal.ZERO;
        if (!allRefundTxs.isEmpty()) {
            for (RefundTransaction tx : allRefundTxs) {
                if (RefundStatus.CONFIRMED.equalsIgnoreCase(tx.getStatus())) {
                    LocalDate confirmedDate = tx.getConfirmedAt() != null
                            ? tx.getConfirmedAt().toLocalDate()
                            : (tx.getRequestedAt() != null ? tx.getRequestedAt().toLocalDate() : null);
                    if (isDateInPeriod(confirmedDate, fromDate, toDate)) {
                        BigDecimal amt = tx.getConfirmedAmount() != null ? tx.getConfirmedAmount() : tx.getRequestedAmount();
                        if (amt != null) totalRefunded = totalRefunded.add(amt);
                    }
                } else if (RefundStatus.REQUESTED.equalsIgnoreCase(tx.getStatus())
                        || RefundStatus.PENDING_CHANNEL.equalsIgnoreCase(tx.getStatus())
                        || RefundStatus.FAILED.equalsIgnoreCase(tx.getStatus())) {
                    if (tx.getRequestedAmount() != null) {
                        pendingRefundAmount = pendingRefundAmount.add(tx.getRequestedAmount());
                    }
                }
            }
        } else {
            // Fallback when refund_transactions ledger is empty/mocked: ONLY count confirmed refunds, NEVER unpaid/pending
            for (Order o : allOrders) {
                if (!isOrderActuallyPaid(o)) continue;
                BigDecimal confirmed = resolveOrderConfirmedRefund(o);
                if (confirmed.compareTo(BigDecimal.ZERO) > 0
                        && isDateInPeriod(resolvePaidDate(o), fromDate, toDate)) {
                    totalRefunded = totalRefunded.add(confirmed);
                }
                pendingRefundAmount = pendingRefundAmount.add(o.getPendingRefundAmount());
            }
        }

        BigDecimal netRevenue = totalSales.subtract(totalRefunded);

        // 3. Operating costs (COGS + shipping + payment fee + remake + return shipping)
        BigDecimal totalVariableCost = BigDecimal.ZERO;
        for (Order o : actuallyPaidOrdersInPeriod) {
            if (o.getVariableCostAmount() != null) totalVariableCost = totalVariableCost.add(o.getVariableCostAmount());
            if (o.getShippingCostAmount() != null) totalVariableCost = totalVariableCost.add(o.getShippingCostAmount());
            if (o.getPaymentFeeAmount() != null) totalVariableCost = totalVariableCost.add(o.getPaymentFeeAmount());
            for (AfterSalesTicket tk : ticketsByOrder.getOrDefault(o.getOrderNumber(), List.of())) {
                if (tk.getRemakeCostAmount() != null) totalVariableCost = totalVariableCost.add(tk.getRemakeCostAmount());
                if (tk.getReturnShippingCost() != null) totalVariableCost = totalVariableCost.add(tk.getReturnShippingCost());
            }
        }
        BigDecimal netContribution = netRevenue.subtract(totalVariableCost);

        BigDecimal averageOrderValue = BigDecimal.ZERO;
        if (!actuallyPaidOrdersInPeriod.isEmpty()) {
            averageOrderValue = totalSales.divide(BigDecimal.valueOf(actuallyPaidOrdersInPeriod.size()), 2, RoundingMode.HALF_UP);
        }

        LocalDateTime now = BusinessClock.now();
        long pendingReviewCount = allOrders.stream()
                .filter(o -> OrderStatus.PAID.equalsIgnoreCase(o.getStatus())
                        && FulfillmentStatus.PENDING_REVIEW.equalsIgnoreCase(o.getFulfillmentStatus()))
                .count();
        long awaitingPrepayReviewCount = allOrders.stream()
                .filter(o -> OrderStatus.AWAITING_REVIEW.equalsIgnoreCase(o.getStatus()))
                .count();
        long quoteReadyCount = allOrders.stream()
                .filter(o -> OrderStatus.QUOTE_READY.equalsIgnoreCase(o.getStatus()))
                .count();
        long expiredHoldCount = allOrders.stream()
                .filter(o -> isHoldOverdue(o, now))
                .count();
        long refundPendingCount = allOrders.stream()
                .filter(o -> OrderStatus.REFUND_PENDING.equalsIgnoreCase(o.getStatus())
                        || o.getPendingRefundAmount().compareTo(BigDecimal.ZERO) > 0)
                .count();

        // On-Time Delivery Rate in consistent Asia/Shanghai business timezone (P0-05)
        LocalDate today = BusinessClock.today();
        long dueCount = 0;
        long onTimeDeliveredCount = 0;
        long delayedCount = 0;
        long cancelledCount = 0;
        long needsInfoCount = 0;
        long rescheduledCount = 0;
        long backfilledPromiseCount = 0;
        for (Order o : allOrders) {
            if ("MIGRATION_BACKFILLED".equalsIgnoreCase(o.getInitialPromisedSource())) {
                backfilledPromiseCount++;
            }
            if (OrderStatus.CANCELLED.equalsIgnoreCase(o.getStatus())
                    || OrderStatus.REFUNDED.equalsIgnoreCase(o.getStatus())) {
                cancelledCount++;
                continue;
            }
            if (FulfillmentStatus.NEEDS_INFO.equalsIgnoreCase(o.getFulfillmentStatus())) {
                needsInfoCount++;
            }
            LocalDate initialPromised = o.getInitialPromisedDeliveryDate() != null
                    ? o.getInitialPromisedDeliveryDate()
                    : o.getEstimatedDeliveryDate();
            if (initialPromised != null && o.getEstimatedDeliveryDate() != null
                    && o.getEstimatedDeliveryDate().isAfter(initialPromised)) {
                rescheduledCount++;
            }
            boolean isPaidOrFulfilled = OrderStatus.PAID.equalsIgnoreCase(o.getStatus())
                    || OrderStatus.SHIPPED.equalsIgnoreCase(o.getStatus())
                    || OrderStatus.DELIVERED.equalsIgnoreCase(o.getStatus());
            if (isPaidOrFulfilled && initialPromised != null && !initialPromised.isAfter(today)) {
                dueCount++;
                if (o.getDeliveredAt() != null && !o.getDeliveredAt().toLocalDate().isAfter(initialPromised)) {
                    onTimeDeliveredCount++;
                } else {
                    delayedCount++;
                }
            }
        }
        BigDecimal onTimeRatePct = dueCount > 0
                ? BigDecimal.valueOf(onTimeDeliveredCount * 100.0 / dueCount).setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        Map<String, Object> onTimeMetrics = new LinkedHashMap<>();
        onTimeMetrics.put("dueCount", dueCount);
        onTimeMetrics.put("onTimeDeliveredCount", onTimeDeliveredCount);
        onTimeMetrics.put("delayedCount", delayedCount);
        onTimeMetrics.put("onTimeRatePct", onTimeRatePct);
        onTimeMetrics.put("cancelledCount", cancelledCount);
        onTimeMetrics.put("needsInfoCount", needsInfoCount);
        onTimeMetrics.put("rescheduledCount", rescheduledCount);
        onTimeMetrics.put("backfilledPromiseCount", backfilledPromiseCount);

        Map<String, Map<String, Object>> byProductMap = new LinkedHashMap<>();
        Map<String, Map<String, Object>> bySourceMap = new LinkedHashMap<>();
        for (Order o : allOrders) {
            if (!isOrderActuallyPaid(o)) continue;
            BigDecimal periodReceipt = isDateInPeriod(resolvePaidDate(o), fromDate, toDate)
                    ? (o.getTotalAmount() != null ? o.getTotalAmount() : BigDecimal.ZERO)
                    : BigDecimal.ZERO;
            BigDecimal periodRefund = resolvePeriodConfirmedRefundForOrder(o, refundsByOrder.getOrDefault(o.getOrderNumber(), List.of()), fromDate, toDate);
            if (fromDate != null || toDate != null) {
                if (periodReceipt.compareTo(BigDecimal.ZERO) == 0 && periodRefund.compareTo(BigDecimal.ZERO) == 0) {
                    continue;
                }
            }

            String prodKey = o.getProductNameSnapshot() != null && !o.getProductNameSnapshot().isBlank()
                    ? o.getProductNameSnapshot()
                    : (o.getProduct() != null ? o.getProduct().getName() : "Unknown");
            String srcKey = o.getOrderSource() != null && !o.getOrderSource().isBlank() ? o.getOrderSource() : "DIRECT";

            BigDecimal cost = BigDecimal.ZERO;
            if (periodReceipt.compareTo(BigDecimal.ZERO) > 0) {
                if (o.getVariableCostAmount() != null) cost = cost.add(o.getVariableCostAmount());
                if (o.getShippingCostAmount() != null) cost = cost.add(o.getShippingCostAmount());
                if (o.getPaymentFeeAmount() != null) cost = cost.add(o.getPaymentFeeAmount());
            }
            List<AfterSalesTicket> orderTickets = ticketsByOrder.getOrDefault(o.getOrderNumber(), List.of());
            for (AfterSalesTicket tk : orderTickets) {
                if (tk.getRemakeCostAmount() != null) cost = cost.add(tk.getRemakeCostAmount());
                if (tk.getReturnShippingCost() != null) cost = cost.add(tk.getReturnShippingCost());
            }

            accumulateContribution(byProductMap, prodKey, periodReceipt, periodRefund, cost, orderTickets.size());
            accumulateContribution(bySourceMap, srcKey, periodReceipt, periodRefund, cost, orderTickets.size());
        }

        Map<String, Long> afterSalesByRootCause = allTickets.stream()
                .collect(Collectors.groupingBy(
                        tk -> tk.getRootCause() != null && !tk.getRootCause().isBlank() ? tk.getRootCause() : "UNCLASSIFIED",
                        Collectors.counting()
                ));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalOrders", totalOrders);
        result.put("totalUsers", totalUsers);
        result.put("totalSales", totalSales);
        result.put("grossReceipts", totalSales);
        result.put("totalRefunded", totalRefunded);
        result.put("confirmedRefunded", totalRefunded);
        result.put("pendingRefundAmount", pendingRefundAmount);
        result.put("netRevenue", netRevenue);
        result.put("totalVariableCost", totalVariableCost);
        result.put("netContribution", netContribution);
        result.put("averageOrderValue", averageOrderValue);
        result.put("pendingReviewCount", pendingReviewCount);
        result.put("awaitingPrepayReviewCount", awaitingPrepayReviewCount);
        result.put("quoteReadyCount", quoteReadyCount);
        result.put("expiredHoldCount", expiredHoldCount);
        result.put("refundPendingCount", refundPendingCount);
        result.put("onTimeDeliveryMetrics", onTimeMetrics);
        result.put("contributionByProduct", new ArrayList<>(byProductMap.values()));
        result.put("contributionBySource", new ArrayList<>(bySourceMap.values()));
        result.put("afterSalesByRootCause", afterSalesByRootCause);
        result.put("businessTimeZone", BusinessClock.BUSINESS_ZONE.getId());
        return ResponseEntity.ok(result);
    }

    private boolean isOrderActuallyPaid(Order o) {
        if (o == null) return false;
        if (o.getPaidAt() != null) return true;
        String s = o.getStatus();
        return OrderStatus.PAID.equalsIgnoreCase(s)
                || OrderStatus.SHIPPED.equalsIgnoreCase(s)
                || OrderStatus.DELIVERED.equalsIgnoreCase(s)
                || OrderStatus.REFUNDED.equalsIgnoreCase(s)
                || OrderStatus.REFUND_PENDING.equalsIgnoreCase(s);
    }

    private LocalDate resolvePaidDate(Order o) {
        if (o.getPaidAt() != null) return o.getPaidAt().toLocalDate();
        if (o.getCreatedAt() != null) return o.getCreatedAt().toLocalDate();
        return null;
    }

    private BigDecimal resolveOrderConfirmedRefund(Order o) {
        if (o.getConfirmedRefundAmount().compareTo(BigDecimal.ZERO) > 0) {
            return o.getConfirmedRefundAmount();
        }
        if (OrderStatus.REFUND_PENDING.equalsIgnoreCase(o.getStatus())) {
            return BigDecimal.ZERO;
        }
        return o.getRefundAmount() != null ? o.getRefundAmount() : BigDecimal.ZERO;
    }

    private BigDecimal resolvePeriodConfirmedRefundForOrder(
            Order o,
            List<RefundTransaction> orderTxs,
            LocalDate fromDate,
            LocalDate toDate) {
        if (orderTxs != null && !orderTxs.isEmpty()) {
            BigDecimal sum = BigDecimal.ZERO;
            for (RefundTransaction tx : orderTxs) {
                if (!RefundStatus.CONFIRMED.equalsIgnoreCase(tx.getStatus())) continue;
                LocalDate d = tx.getConfirmedAt() != null
                        ? tx.getConfirmedAt().toLocalDate()
                        : (tx.getRequestedAt() != null ? tx.getRequestedAt().toLocalDate() : null);
                if (isDateInPeriod(d, fromDate, toDate)) {
                    BigDecimal amt = tx.getConfirmedAmount() != null ? tx.getConfirmedAmount() : tx.getRequestedAmount();
                    if (amt != null) sum = sum.add(amt);
                }
            }
            return sum;
        }
        BigDecimal legacyConfirmed = resolveOrderConfirmedRefund(o);
        if (legacyConfirmed.compareTo(BigDecimal.ZERO) > 0 && isDateInPeriod(resolvePaidDate(o), fromDate, toDate)) {
            return legacyConfirmed;
        }
        return BigDecimal.ZERO;
    }

    private boolean isDateInPeriod(LocalDate date, LocalDate fromDate, LocalDate toDate) {
        if (fromDate == null && toDate == null) return true;
        if (date == null) return false;
        if (fromDate != null && date.isBefore(fromDate)) return false;
        if (toDate != null && date.isAfter(toDate)) return false;
        return true;
    }

    private boolean isHoldOverdue(Order o, LocalDateTime now) {
        String s = o.getStatus();
        if (OrderStatus.AWAITING_REVIEW.equalsIgnoreCase(s)) {
            LocalDateTime deadline = o.getReviewExpiresAt() != null
                    ? o.getReviewExpiresAt()
                    : (o.getCreatedAt() != null ? o.getCreatedAt().plusHours(OrderService.DEFAULT_REVIEW_HOLD_HOURS) : null);
            return deadline != null && now.isAfter(deadline);
        }
        if (OrderStatus.QUOTE_READY.equalsIgnoreCase(s)) {
            LocalDateTime deadline = o.getQuoteExpiresAt() != null
                    ? o.getQuoteExpiresAt()
                    : (o.getOpticianVerifiedAt() != null
                            ? o.getOpticianVerifiedAt().plusHours(OrderService.DEFAULT_QUOTE_HOLD_HOURS)
                            : (o.getCreatedAt() != null ? o.getCreatedAt().plusHours(OrderService.DEFAULT_QUOTE_HOLD_HOURS) : null));
            return deadline != null && now.isAfter(deadline);
        }
        if (OrderStatus.CREATED.equalsIgnoreCase(s) || OrderStatus.PENDING_PAYMENT.equalsIgnoreCase(s)) {
            LocalDateTime base = o.getCustomerQuoteConfirmedAt() != null ? o.getCustomerQuoteConfirmedAt() : o.getCreatedAt();
            return base != null && now.isAfter(base.plusMinutes(OrderService.DEFAULT_PAYMENT_HOLD_MINUTES));
        }
        return false;
    }

    private void accumulateContribution(
            Map<String, Map<String, Object>> bucketMap,
            String key,
            BigDecimal gross,
            BigDecimal refunded,
            BigDecimal cost,
            long ticketCount) {
        Map<String, Object> row = bucketMap.computeIfAbsent(key, k -> {
            Map<String, Object> init = new LinkedHashMap<>();
            init.put("key", k);
            init.put("orderCount", 0L);
            init.put("grossRevenue", BigDecimal.ZERO);
            init.put("refundedAmount", BigDecimal.ZERO);
            init.put("variableCost", BigDecimal.ZERO);
            init.put("netContribution", BigDecimal.ZERO);
            init.put("ticketCount", 0L);
            return init;
        });
        row.put("orderCount", ((Long) row.get("orderCount")) + 1L);
        BigDecimal nextGross = ((BigDecimal) row.get("grossRevenue")).add(gross);
        BigDecimal nextRefund = ((BigDecimal) row.get("refundedAmount")).add(refunded);
        BigDecimal nextCost = ((BigDecimal) row.get("variableCost")).add(cost);
        row.put("grossRevenue", nextGross);
        row.put("refundedAmount", nextRefund);
        row.put("variableCost", nextCost);
        row.put("netContribution", nextGross.subtract(nextRefund).subtract(nextCost));
        row.put("ticketCount", ((Long) row.get("ticketCount")) + ticketCount);
    }

    @GetMapping(value = "/reconciliation/export", produces = "text/csv; charset=UTF-8")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> exportReconciliationCsv(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        LocalDate fromDate = (from != null && !from.isBlank()) ? LocalDate.parse(from.trim()) : null;
        LocalDate toDate = (to != null && !to.isBlank()) ? LocalDate.parse(to.trim()) : null;

        boolean periodScoped = fromDate != null || toDate != null;
        List<RefundTransaction> allRefundTxs;
        List<Order> candidateOrders;
        if (periodScoped) {
            LocalDateTime fromInclusive = fromDate != null ? fromDate.atStartOfDay() : null;
            LocalDateTime toExclusive = toDate != null ? toDate.plusDays(1).atStartOfDay() : null;
            allRefundTxs = refundTransactionRepository != null
                    ? safeList(refundTransactionRepository.findConfirmedRefundsInPeriod(fromInclusive, toExclusive))
                    : List.of();
            Map<String, Order> orderMap = new LinkedHashMap<>();
            for (Order o : safeList(orderRepository.findPaidOrdersInPeriod(fromInclusive, toExclusive))) {
                if (o.getOrderNumber() != null) orderMap.put(o.getOrderNumber(), o);
            }
            Set<String> extraOrderNumbers = new HashSet<>();
            for (RefundTransaction tx : allRefundTxs) {
                if (tx.getOrderNumber() != null && !orderMap.containsKey(tx.getOrderNumber())) {
                    extraOrderNumbers.add(tx.getOrderNumber());
                }
            }
            if (!extraOrderNumbers.isEmpty()) {
                for (Order extra : safeList(orderRepository.findByOrderNumberIn(extraOrderNumbers))) {
                    if (extra.getOrderNumber() != null) orderMap.putIfAbsent(extra.getOrderNumber(), extra);
                }
            }
            candidateOrders = new ArrayList<>(orderMap.values());
        } else {
            allRefundTxs = refundTransactionRepository != null
                    ? safeList(refundTransactionRepository.findAll())
                    : List.of();
            candidateOrders = safeList(orderRepository.findAll());
        }

        Map<String, List<RefundTransaction>> refundsByOrder = allRefundTxs.stream()
                .collect(Collectors.groupingBy(RefundTransaction::getOrderNumber));

        // P0-08: When from/to specified, filter by actual payment OR confirmed-refund occurrence date!
        List<Order> orders = candidateOrders.stream()
                .filter(o -> {
                    if (!periodScoped) return true;
                    boolean paidInPeriod = isOrderActuallyPaid(o) && isDateInPeriod(resolvePaidDate(o), fromDate, toDate);
                    BigDecimal refundInPeriod = resolvePeriodConfirmedRefundForOrder(
                            o, refundsByOrder.getOrDefault(o.getOrderNumber(), List.of()), fromDate, toDate);
                    return paidInPeriod || refundInPeriod.compareTo(BigDecimal.ZERO) > 0;
                })
                .sorted((a, b) -> {
                    LocalDateTime ta = a.getPaidAt() != null ? a.getPaidAt() : a.getCreatedAt();
                    LocalDateTime tb = b.getPaidAt() != null ? b.getPaidAt() : b.getCreatedAt();
                    if (ta == null && tb == null) return 0;
                    if (ta == null) return 1;
                    if (tb == null) return -1;
                    return tb.compareTo(ta);
                })
                .toList();

        List<String> exportedOrderNumbers = orders.stream()
                .map(Order::getOrderNumber)
                .filter(n -> n != null && !n.isBlank())
                .toList();
        Map<String, List<AfterSalesTicket>> ticketsByOrder;
        if (afterSalesTicketRepository == null || exportedOrderNumbers.isEmpty()) {
            ticketsByOrder = Map.of();
        } else if (periodScoped) {
            ticketsByOrder = safeList(afterSalesTicketRepository.findByOrderNumberIn(exportedOrderNumbers)).stream()
                    .collect(Collectors.groupingBy(AfterSalesTicket::getOrderNumber));
        } else {
            ticketsByOrder = safeList(afterSalesTicketRepository.findAll()).stream()
                    .collect(Collectors.groupingBy(AfterSalesTicket::getOrderNumber));
        }

        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF');
        sb.append("order_number,created_at,paid_at,status,fulfillment_status,product,finish_id,size_spec,order_source,")
          .append("payment_channel,gateway_transaction_id,period_receipt_amount,discount_amount,period_confirmed_refund,")
          .append("pending_refund_amount,period_net_cash,variable_cost,shipping_cost,payment_fee,remake_cost,net_contribution,")
          .append("initial_promised_date,initial_promised_source,current_estimated_date,delivered_at,on_time_status,")
          .append("qc_status,after_sales_tickets,remake_tracking,root_causes,finance_verified\n");

        LocalDate today = BusinessClock.today();
        for (Order o : orders) {
            boolean paidInPeriod = isOrderActuallyPaid(o) && isDateInPeriod(resolvePaidDate(o), fromDate, toDate);
            BigDecimal periodReceipt = paidInPeriod && o.getTotalAmount() != null ? o.getTotalAmount() : BigDecimal.ZERO;
            BigDecimal discount = o.getDiscountAmount() != null ? o.getDiscountAmount() : BigDecimal.ZERO;
            BigDecimal periodConfirmedRefund = resolvePeriodConfirmedRefundForOrder(
                    o, refundsByOrder.getOrDefault(o.getOrderNumber(), List.of()), fromDate, toDate);
            BigDecimal pendingRefund = o.getPendingRefundAmount();
            BigDecimal periodNetCash = periodReceipt.subtract(periodConfirmedRefund);

            BigDecimal varCost = o.getVariableCostAmount() != null ? o.getVariableCostAmount() : BigDecimal.ZERO;
            BigDecimal shipCost = o.getShippingCostAmount() != null ? o.getShippingCostAmount() : BigDecimal.ZERO;
            BigDecimal payFee = o.getPaymentFeeAmount() != null ? o.getPaymentFeeAmount() : BigDecimal.ZERO;
            List<AfterSalesTicket> orderTickets = ticketsByOrder.getOrDefault(o.getOrderNumber(), List.of());
            BigDecimal remakeCost = orderTickets.stream()
                    .map(tk -> (tk.getRemakeCostAmount() != null ? tk.getRemakeCostAmount() : BigDecimal.ZERO)
                            .add(tk.getReturnShippingCost() != null ? tk.getReturnShippingCost() : BigDecimal.ZERO))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal contribution = periodNetCash.subtract(varCost).subtract(shipCost).subtract(payFee).subtract(remakeCost);

            LocalDate initialPromised = o.getInitialPromisedDeliveryDate() != null
                    ? o.getInitialPromisedDeliveryDate()
                    : o.getEstimatedDeliveryDate();

            String onTimeStatus = "PENDING";
            if (OrderStatus.CANCELLED.equalsIgnoreCase(o.getStatus()) || OrderStatus.REFUNDED.equalsIgnoreCase(o.getStatus())) {
                onTimeStatus = "CANCELLED_OR_REFUNDED";
            } else if (o.getDeliveredAt() != null && initialPromised != null) {
                onTimeStatus = !o.getDeliveredAt().toLocalDate().isAfter(initialPromised) ? "ON_TIME" : "DELAYED_DELIVERED";
            } else if (initialPromised != null && initialPromised.isBefore(today)) {
                onTimeStatus = "OVERDUE";
            }

            String ticketNums = orderTickets.stream().map(AfterSalesTicket::getTicketNumber).collect(Collectors.joining(";"));
            String remakeTrack = orderTickets.stream()
                    .map(AfterSalesTicket::getRemakeTrackingNumber)
                    .filter(v -> v != null && !v.isBlank())
                    .collect(Collectors.joining(";"));
            String rootCauses = orderTickets.stream()
                    .map(AfterSalesTicket::getRootCause)
                    .filter(v -> v != null && !v.isBlank())
                    .collect(Collectors.joining(";"));
            boolean anyFinanceVerified = orderTickets.stream().anyMatch(tk -> tk.getFinanceVerifiedAt() != null);

            String prodName = o.getProductNameSnapshot() != null && !o.getProductNameSnapshot().isBlank()
                    ? o.getProductNameSnapshot()
                    : (o.getProduct() != null ? o.getProduct().getName() : "");

            sb.append(csv(o.getOrderNumber())).append(',')
              .append(csv(o.getCreatedAt())).append(',')
              .append(csv(o.getPaidAt())).append(',')
              .append(csv(o.getStatus())).append(',')
              .append(csv(o.getFulfillmentStatus())).append(',')
              .append(csv(prodName)).append(',')
              .append(csv(o.getFinishId())).append(',')
              .append(csv(o.getSizeSpecSnapshot())).append(',')
              .append(csv(o.getOrderSource() != null ? o.getOrderSource() : "DIRECT")).append(',')
              .append(csv(o.getPaymentChannel())).append(',')
              .append(csv(o.getGatewayTransactionId())).append(',')
              .append(periodReceipt.toPlainString()).append(',')
              .append(discount.toPlainString()).append(',')
              .append(periodConfirmedRefund.toPlainString()).append(',')
              .append(pendingRefund.toPlainString()).append(',')
              .append(periodNetCash.toPlainString()).append(',')
              .append(varCost.toPlainString()).append(',')
              .append(shipCost.toPlainString()).append(',')
              .append(payFee.toPlainString()).append(',')
              .append(remakeCost.toPlainString()).append(',')
              .append(contribution.toPlainString()).append(',')
              .append(csv(initialPromised)).append(',')
              .append(csv(o.getInitialPromisedSource())).append(',')
              .append(csv(o.getEstimatedDeliveryDate())).append(',')
              .append(csv(o.getDeliveredAt())).append(',')
              .append(csv(onTimeStatus)).append(',')
              .append(csv(o.getQcStatus())).append(',')
              .append(csv(ticketNums)).append(',')
              .append(csv(remakeTrack)).append(',')
              .append(csv(rootCauses)).append(',')
              .append(anyFinanceVerified ? "YES" : "NO")
              .append('\n');
        }

        byte[] bytes = sb.toString().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"klarheit-reconciliation.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(bytes);
    }

    private BigDecimal parseOptionalDecimal(Object raw) {
        if (raw == null || String.valueOf(raw).isBlank()) return null;
        return new BigDecimal(String.valueOf(raw).trim());
    }

    private String maskAddressForAudit(String rawAddress) {
        if (rawAddress == null || rawAddress.isBlank()) return "";
        String trimmed = rawAddress.trim();
        if (trimmed.length() <= 6) {
            return "***";
        }
        return trimmed.substring(0, 6) + "***(" + trimmed.length() + " chars)";
    }

    private String csv(Object value) {
        if (value == null) return "";
        String s = String.valueOf(value);
        if (!s.isEmpty() && (s.startsWith("=") || s.startsWith("+") || s.startsWith("-") || s.startsWith("@"))) {
            s = "'" + s;
        }
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    private <T> List<T> safeList(List<T> raw) {
        return raw != null ? raw : List.of();
    }

    // ── Sec 6 P1: Operational Alerts & Email Failure Outbox ───

    @GetMapping("/alerts")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getOperationalAlerts() {
        LocalDateTime now = BusinessClock.now();
        LocalDate today = BusinessClock.today();

        List<Order> awaitingReview = safeList(orderRepository.findByStatus(OrderStatus.AWAITING_REVIEW));
        List<Order> quoteReady = safeList(orderRepository.findByStatus(OrderStatus.QUOTE_READY));
        List<Order> created = safeList(orderRepository.findByStatus(OrderStatus.CREATED));
        List<Order> pendingPayment = safeList(orderRepository.findByStatus(OrderStatus.PENDING_PAYMENT));
        List<Order> paid = safeList(orderRepository.findByStatus(OrderStatus.PAID));
        List<Order> shipped = safeList(orderRepository.findByStatus(OrderStatus.SHIPPED));
        List<Order> refundPending = safeList(orderRepository.findByStatus(OrderStatus.REFUND_PENDING));

        long awaitingReviewCount = awaitingReview.size();

        long expiredHoldCount = 0;
        for (List<Order> bucket : List.of(awaitingReview, quoteReady, created, pendingPayment)) {
            for (Order o : bucket) {
                if (isHoldOverdue(o, now)) {
                    expiredHoldCount++;
                }
            }
        }

        long delayedDeliveryCount = 0;
        for (List<Order> bucket : List.of(paid, shipped)) {
            for (Order o : bucket) {
                LocalDate promised = o.getInitialPromisedDeliveryDate() != null
                        ? o.getInitialPromisedDeliveryDate()
                        : o.getEstimatedDeliveryDate();
                if (promised != null && !promised.isAfter(today) && o.getDeliveredAt() == null) {
                    delayedDeliveryCount++;
                }
            }
        }

        Set<String> unresolvedRefundOrderNumbers = new HashSet<>();
        for (Order o : refundPending) {
            if (o.getOrderNumber() != null) unresolvedRefundOrderNumbers.add(o.getOrderNumber());
        }
        if (refundTransactionRepository != null) {
            for (RefundTransaction tx : safeList(refundTransactionRepository.findByStatusIn(List.of(
                    RefundStatus.REQUESTED, RefundStatus.PENDING_CHANNEL, RefundStatus.FAILED)))) {
                unresolvedRefundOrderNumbers.add(
                        tx.getOrderNumber() != null ? tx.getOrderNumber() : tx.getRefundRequestId());
            }
        }
        long unresolvedRefundCount = unresolvedRefundOrderNumbers.size();

        long failedEmailCount = emailService != null ? emailService.countFailedNotifications() : 0L;
        long overdueAfterSalesCount = afterSalesTicketRepository != null
                ? afterSalesTicketRepository.countOverdueOpenTickets(now.minusHours(24))
                : 0L;

        List<Map<String, Object>> alerts = new ArrayList<>();
        alerts.add(buildAlertItem("AWAITING_REVIEW", "WARNING", awaitingReviewCount, StaffRoles.OPTICIAN));
        alerts.add(buildAlertItem("EXPIRED_HOLDS", "CRITICAL", expiredHoldCount, StaffRoles.OPTICIAN));
        alerts.add(buildAlertItem("DELAYED_DELIVERY", "CRITICAL", delayedDeliveryCount, StaffRoles.WAREHOUSE));
        alerts.add(buildAlertItem("UNRESOLVED_REFUNDS", "CRITICAL", unresolvedRefundCount, StaffRoles.FINANCE));
        alerts.add(buildAlertItem("FAILED_EMAILS", "WARNING", failedEmailCount, StaffRoles.CUSTOMER_SERVICE));
        alerts.add(buildAlertItem("OVERDUE_AFTER_SALES", "WARNING", overdueAfterSalesCount, StaffRoles.CUSTOMER_SERVICE));

        long totalActionable = alerts.stream()
                .mapToLong(item -> ((Number) item.get("count")).longValue())
                .sum();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("generatedAt", now.toString());
        response.put("businessTimeZone", BusinessClock.BUSINESS_ZONE.getId());
        response.put("totalActionable", totalActionable);
        response.put("alerts", alerts);
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> buildAlertItem(String key, String severity, long count, String ownerRole) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("key", key);
        item.put("severity", severity);
        item.put("count", count);
        item.put("ownerRole", ownerRole);
        return item;
    }

    @GetMapping("/notifications")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<EmailNotificationLog>> listEmailNotifications(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        if (emailService == null) {
            return ResponseEntity.ok(Page.empty(pageable));
        }
        return ResponseEntity.ok(emailService.listNotifications(status, pageable));
    }

    @PostMapping("/notifications/{id}/resend")
    @Transactional
    public ResponseEntity<EmailNotificationLog> resendEmailNotification(
            @PathVariable Long id,
            Authentication authentication) {
        if (emailService == null) {
            throw new IllegalStateException("Email service is unavailable.");
        }
        String operator = authentication != null ? authentication.getName() : "admin";
        EmailNotificationLog updated = emailService.resendNotification(id, operator);
        auditLogService.log(operator, "RESEND_EMAIL", TARGET_NOTIFICATION, String.valueOf(id),
                "eventKey=" + updated.getEventKey()
                        + "; status=" + updated.getStatus()
                        + "; attempts=" + updated.getAttemptCount());
        return ResponseEntity.ok(updated);
    }

    // ── Checkout Kill Switch Settings ──────────────────────────

    @GetMapping("/settings/checkout")
    public ResponseEntity<Map<String, Object>> getCheckoutSetting() {
        boolean enabled = systemSettingService == null || systemSettingService.isCheckoutEnabled();
        String reason = systemSettingService != null ? systemSettingService.getCheckoutPauseReason() : "";
        return ResponseEntity.ok(Map.of(
                "checkoutEnabled", enabled,
                "pauseReason", reason
        ));
    }

    @PutMapping("/settings/checkout")
    public ResponseEntity<Map<String, Object>> updateCheckoutSetting(
            @RequestBody Map<String, Object> request,
            Authentication authentication) {
        boolean enabled = Boolean.TRUE.equals(request.get("checkoutEnabled"));
        String reason = request.get("pauseReason") != null ? String.valueOf(request.get("pauseReason")) : "";
        if (systemSettingService != null) {
            systemSettingService.setCheckoutEnabled(enabled, reason, authentication.getName());
        }
        auditLogService.log(authentication.getName(), "TOGGLE_CHECKOUT", TARGET_SETTING, "checkout_enabled",
                "enabled=" + enabled + "; reason=" + reason);
        return ResponseEntity.ok(Map.of(
                "checkoutEnabled", enabled,
                "pauseReason", reason
        ));
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<Page<AuditLog>> getAuditLogs(@PageableDefault(size = 30) Pageable pageable) {
        if (auditLogRepository == null) {
            return ResponseEntity.ok(Page.empty(pageable));
        }
        return ResponseEntity.ok(auditLogRepository.findAllByOrderByTimestampDesc(pageable));
    }

    // ── Product & SKU Stocktake Management ─────────────────────

    @GetMapping("/products")
    public ResponseEntity<List<ProductResponseDTO>> getAllProducts() {
        List<ProductResponseDTO> all = productService.getAllCatalogIncludingArchived();
        if (all != null && !all.isEmpty()) {
            return ResponseEntity.ok(all);
        }
        return ResponseEntity.ok(productService.getCatalog());
    }

    @PostMapping("/products")
    public ResponseEntity<ProductResponseDTO> createProduct(@RequestBody ProductRequestDTO request,
                                                             Authentication authentication) {
        ProductResponseDTO created = productService.createProduct(request);
        auditLogService.log(authentication.getName(), "CREATE_PRODUCT", TARGET_PRODUCT,
                String.valueOf(created.id()), "name=" + created.nameEn());
        return ResponseEntity.ok(created);
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<ProductResponseDTO> updateProduct(
            @PathVariable Long id,
            @RequestBody ProductRequestDTO request,
            Authentication authentication) {
        ProductResponseDTO updated = productService.updateProduct(id, request);
        auditLogService.log(authentication.getName(), "UPDATE_PRODUCT", TARGET_PRODUCT,
                String.valueOf(id), "name=" + updated.nameEn()
                        + "; stock=" + updated.stockQuantity()
                        + "; status=" + updated.salesStatus());
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id, Authentication authentication) {
        productService.deleteProduct(id);
        auditLogService.log(authentication.getName(), "DELETE_PRODUCT", TARGET_PRODUCT,
                String.valueOf(id), null);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/products/{id}/skus")
    public ResponseEntity<List<ProductSkuDTO>> getProductSkus(@PathVariable Long id) {
        return ResponseEntity.ok(productService.getSkusForProduct(id));
    }

    @PutMapping("/products/{id}/skus")
    public ResponseEntity<ProductSkuDTO> upsertProductSku(
            @PathVariable Long id,
            @Valid @RequestBody ProductSkuUpsertDTO request,
            Authentication authentication) {
        ProductSkuDTO saved = productService.upsertSku(id, request);
        auditLogService.log(authentication.getName(), "UPSERT_PRODUCT_SKU", TARGET_PRODUCT,
                id + ":" + saved.finishId() + ":" + saved.sizeSpec(),
                "onHand=" + saved.onHandQty() + "; status=" + saved.salesStatus()
                        + (saved.supplierName() != null ? "; supplier=" + saved.supplierName() : ""));
        return ResponseEntity.ok(saved);
    }

    /**
     * P0-02: Batch import physical warehouse stocktake sheet (marks SKUs stocktakeVerified=true).
     */
    @PostMapping("/inventory/stocktake-import")
    public ResponseEntity<List<ProductSkuDTO>> importPhysicalStocktake(
            @Valid @RequestBody List<@Valid StocktakeItemDTO> items,
            Authentication authentication) {
        String operator = authentication != null ? authentication.getName() : "warehouse";
        List<ProductSkuDTO> imported = productService.importPhysicalStocktake(items, operator);
        auditLogService.log(operator, "IMPORT_PHYSICAL_STOCKTAKE", TARGET_PRODUCT, "BATCH",
                "importedSkus=" + imported.size());
        return ResponseEntity.ok(imported);
    }

    // ── User Management & Role Governance (P0-10) ──────────────

    @GetMapping("/users")
    public ResponseEntity<Page<UserProfileDTO>> getAllUsers(
            @PageableDefault(size = 20) Pageable pageable) {
        Page<UserProfileDTO> users = userAccountRepository.findAll(pageable)
                .map(user -> new UserProfileDTO(
                        user.getId(),
                        user.getEmail(),
                        user.getFirstName(),
                        user.getLastName(),
                        user.getPhone(),
                        user.isPhoneVerified(),
                        user.getRole()
                ));
        return ResponseEntity.ok(users);
    }

    @PutMapping("/users/{id}/role")
    @Transactional
    public ResponseEntity<UserProfileDTO> updateUserRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        String targetRole = request.get("role");
        if (targetRole == null || !StaffRoles.isValidRole(targetRole)) {
            throw new IllegalArgumentException("无效角色，可选角色：" + StaffRoles.ALL_VALID_ROLES);
        }
        UserAccount user = userAccountRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        String previousRole = user.getRole();
        String normalizedRole = targetRole.trim().toUpperCase();
        user.setRole(normalizedRole);
        userAccountRepository.save(user);

        String operator = authentication != null ? authentication.getName() : "admin";
        auditLogService.log(operator, "UPDATE_USER_ROLE", TARGET_USER, String.valueOf(id),
                "email=" + user.getEmail() + "; role=" + previousRole + "->" + normalizedRole);
        return ResponseEntity.ok(new UserProfileDTO(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhone(),
                user.isPhoneVerified(),
                user.getRole()
        ));
    }
}
