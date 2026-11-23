package com.klarheit.backend.aftersales;

import com.klarheit.backend.aftersales.dto.AfterSalesTicketRequestDTO;
import com.klarheit.backend.aftersales.dto.AfterSalesTicketResponseDTO;
import com.klarheit.backend.aftersales.dto.AfterSalesTicketUpdateDTO;
import com.klarheit.backend.audit.AuditLogService;
import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserService;
import com.klarheit.backend.order.BusinessClock;
import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderRepository;
import com.klarheit.backend.order.OrderStatus;
import com.klarheit.backend.order.dto.OrderDetailResponseDTO;
import com.klarheit.backend.payment.PaymentService;
import com.klarheit.backend.payment.RefundResult;
import com.klarheit.backend.payment.RefundStatus;
import com.klarheit.backend.payment.RefundTransaction;
import com.klarheit.backend.payment.RefundTransactionRepository;
import com.klarheit.backend.product.ProductRepository;
import com.klarheit.backend.product.ProductSkuRepository;
import com.klarheit.backend.security.StaffRoles;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AfterSalesService {
    private static final DateTimeFormatter TICKET_FMT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final Set<String> VALID_CATEGORIES = Set.of(
            "WRONG_PRESCRIPTION",
            "DAMAGED",
            "FIT_DISCOMFORT",
            "RETURN_EXCHANGE",
            "REMAKE",
            "ADDRESS_CHANGE",
            "INVOICE",
            "NOT_RECEIVED",
            "PRESCRIPTION_SUPPLEMENT",
            "OTHER"
    );
    private static final Set<String> VALID_STATUSES = Set.of(
            "OPEN",
            "AWAITING_CUSTOMER",
            "IN_PROGRESS",
            "RESOLVED",
            "CLOSED"
    );
    private static final Set<String> VALID_RETURN_QC = Set.of(
            "PENDING",
            "RESTOCKABLE",
            "DEFECTIVE_SCRAP",
            "LENS_REMAKE_ONLY"
    );
    private static final Set<String> VALID_RETURN_DISPOSITIONS = Set.of(
            "RESTOCK",
            "SCRAP",
            "CUSTOM_LENS_DESTROY_KEEP_FRAME",
            "PENDING_REVIEW",
            "RETURN_TO_SUPPLIER"
    );
    private static final Set<String> VALID_ROOT_CAUSES = Set.of(
            "OUT_OF_STOCK",
            "RX_INPUT_ERROR",
            "LAB_PROCESSING_ERROR",
            "SHIPPING_DAMAGE",
            "CUSTOMER_CHANGE",
            "OTHER"
    );

    private final AfterSalesTicketRepository ticketRepository;
    private final OrderRepository orderRepository;
    private final UserService userService;
    private final AuditLogService auditLogService;

    @Autowired(required = false)
    private PaymentService paymentService;

    @Autowired(required = false)
    private ProductSkuRepository productSkuRepository;

    @Autowired(required = false)
    private CacheManager cacheManager;

    @Autowired(required = false)
    private ProductRepository productRepository;

    @Autowired(required = false)
    private RefundTransactionRepository refundTransactionRepository;

    public AfterSalesService(AfterSalesTicketRepository ticketRepository,
                             OrderRepository orderRepository,
                             UserService userService,
                             AuditLogService auditLogService) {
        this.ticketRepository = ticketRepository;
        this.orderRepository = orderRepository;
        this.userService = userService;
        this.auditLogService = auditLogService;
    }

    public void setPaymentService(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    public void setProductSkuRepository(ProductSkuRepository productSkuRepository) {
        this.productSkuRepository = productSkuRepository;
    }

    public void setProductRepository(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public void setRefundTransactionRepository(RefundTransactionRepository refundTransactionRepository) {
        this.refundTransactionRepository = refundTransactionRepository;
    }

    @Transactional
    public AfterSalesTicketResponseDTO createTicket(String orderNumber,
                                                    AfterSalesTicketRequestDTO request,
                                                    String authenticatedEmail) {
        UserAccount user = userService.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        boolean isStaff = StaffRoles.isStaffRole(user.getRole());
        boolean isOwner = (order.getUserId() != null && order.getUserId().equals(user.getId()))
                || (order.getCustomerEmail() != null && order.getCustomerEmail().equalsIgnoreCase(user.getEmail()));
        if (!isStaff && !isOwner) {
            throw new IllegalArgumentException("Unauthorized to create a support ticket for this order.");
        }

        String normalizedCategory = request.category().trim().toUpperCase();
        if (!VALID_CATEGORIES.contains(normalizedCategory)) {
            throw new IllegalArgumentException("Unsupported support category: " + normalizedCategory);
        }

        AfterSalesTicket ticket = new AfterSalesTicket();
        ticket.setTicketNumber("AS-" + BusinessClock.now().format(TICKET_FMT) + "-"
                + ThreadLocalRandom.current().nextInt(1000, 10000));
        ticket.setOrderNumber(order.getOrderNumber());
        ticket.setUserId(user.getId());
        ticket.setCategory(normalizedCategory);
        ticket.setReason(request.reason().trim());
        String contact = request.contactInfo() != null && !request.contactInfo().isBlank()
                ? request.contactInfo().trim()
                : (order.getCustomerPhone() != null && !order.getCustomerPhone().isBlank()
                        ? order.getCustomerPhone()
                        : user.getEmail());
        ticket.setContactInfo(contact);
        ticket.setStatus("OPEN");
        ticket.setNextContactAt(BusinessClock.now().plusHours(24));

        AfterSalesTicket saved = ticketRepository.save(ticket);
        return toDTO(saved, isStaff);
    }

    @Transactional(readOnly = true)
    public List<AfterSalesTicketResponseDTO> getTicketsForOrder(String orderNumber, String authenticatedEmail) {
        UserAccount user = userService.findByEmailIgnoreCase(authenticatedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        boolean isStaff = StaffRoles.isStaffRole(user.getRole());
        boolean isOwner = (order.getUserId() != null && order.getUserId().equals(user.getId()))
                || (order.getCustomerEmail() != null && order.getCustomerEmail().equalsIgnoreCase(user.getEmail()));
        if (!isStaff && !isOwner) {
            throw new IllegalArgumentException("Unauthorized to view support tickets for this order.");
        }

        return ticketRepository.findByOrderNumberOrderByCreatedAtDesc(orderNumber)
                .stream()
                .map(t -> toDTO(t, isStaff))
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<AfterSalesTicketResponseDTO> getAllTicketsForAdmin(String status, Pageable pageable) {
        if (status != null && !status.isBlank()) {
            return ticketRepository.findByStatusOrderByCreatedAtDesc(status.trim().toUpperCase(), pageable)
                    .map(t -> toDTO(t, true));
        }
        return ticketRepository.findAllByOrderByCreatedAtDesc(pageable).map(t -> toDTO(t, true));
    }

    @Transactional
    public AfterSalesTicketResponseDTO updateTicketForAdmin(String ticketNumber,
                                                            AfterSalesTicketUpdateDTO request,
                                                            String adminEmail) {
        AfterSalesTicket ticket = ticketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketNumber));

        String previousStatus = ticket.getStatus();
        if (request.status() != null && !request.status().isBlank()) {
            String normalizedStatus = request.status().trim().toUpperCase();
            if (!VALID_STATUSES.contains(normalizedStatus)) {
                throw new IllegalArgumentException("Invalid ticket status: " + normalizedStatus);
            }
            ticket.setStatus(normalizedStatus);
        }
        if (request.assignee() != null) {
            ticket.setAssignee(request.assignee().trim().isEmpty() ? null : request.assignee().trim());
        }
        if (request.resolutionNote() != null) {
            ticket.setResolutionNote(request.resolutionNote().trim().isEmpty() ? null : request.resolutionNote().trim());
        }
        if (request.nextContactAt() != null) {
            ticket.setNextContactAt(request.nextContactAt());
        }
        if (request.returnCarrier() != null) {
            ticket.setReturnCarrier(blankToNull(request.returnCarrier()));
        }
        if (request.returnTrackingNumber() != null) {
            ticket.setReturnTrackingNumber(blankToNull(request.returnTrackingNumber()));
        }
        if (request.returnReceivedAt() != null) {
            ticket.setReturnReceivedAt(request.returnReceivedAt());
            if (ticket.getReturnReceivedBy() == null) {
                ticket.setReturnReceivedBy(adminEmail);
            }
        }
        if (request.returnQcResult() != null && !request.returnQcResult().isBlank()) {
            String qc = request.returnQcResult().trim().toUpperCase();
            if (!VALID_RETURN_QC.contains(qc)) {
                throw new IllegalArgumentException("Invalid return QC result: " + request.returnQcResult());
            }
            ticket.setReturnQcResult(qc);
            ticket.setReturnQcCheckedBy(adminEmail);
            ticket.setReturnQcCheckedAt(BusinessClock.now());
            if (ticket.getReturnReceivedAt() == null) {
                ticket.setReturnReceivedAt(BusinessClock.now());
                ticket.setReturnReceivedBy(adminEmail);
            }
            // Auto-assign sensible non-restockable disposition if not explicitly supplied
            if (request.returnDisposition() == null || request.returnDisposition().isBlank()) {
                if ("DEFECTIVE_SCRAP".equals(qc)) {
                    ticket.setReturnDisposition("SCRAP");
                } else if ("LENS_REMAKE_ONLY".equals(qc)) {
                    ticket.setReturnDisposition("CUSTOM_LENS_DESTROY_KEEP_FRAME");
                } else if ("PENDING".equals(qc)) {
                    ticket.setReturnDisposition("PENDING_REVIEW");
                }
            }
        }
        if (request.returnQcNote() != null) {
            ticket.setReturnQcNote(blankToNull(request.returnQcNote()));
        }
        if (request.returnDisposition() != null && !request.returnDisposition().isBlank()) {
            String disp = request.returnDisposition().trim().toUpperCase();
            if (!VALID_RETURN_DISPOSITIONS.contains(disp)) {
                throw new IllegalArgumentException("Invalid return disposition: " + request.returnDisposition());
            }
            ticket.setReturnDisposition(disp);
        }
        if (request.returnEvidenceNote() != null) {
            ticket.setReturnEvidenceNote(blankToNull(request.returnEvidenceNote()));
        }
        if (request.remakeOrderNumber() != null) {
            ticket.setRemakeOrderNumber(blankToNull(request.remakeOrderNumber()));
        }
        if (request.remakeCarrier() != null) {
            ticket.setRemakeCarrier(blankToNull(request.remakeCarrier()));
        }
        if (request.remakeTrackingNumber() != null) {
            ticket.setRemakeTrackingNumber(blankToNull(request.remakeTrackingNumber()));
        }
        if (request.remakeCostAmount() != null) {
            if (request.remakeCostAmount().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("重做成本不可为负数。");
            }
            ticket.setRemakeCostAmount(request.remakeCostAmount());
        }
        if (request.returnShippingCost() != null) {
            if (request.returnShippingCost().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("退件物流费不可为负数。");
            }
            ticket.setReturnShippingCost(request.returnShippingCost());
        }
        if (request.rootCause() != null && !request.rootCause().isBlank()) {
            String cause = request.rootCause().trim().toUpperCase();
            if (!VALID_ROOT_CAUSES.contains(cause)) {
                throw new IllegalArgumentException("Invalid root cause: " + request.rootCause());
            }
            ticket.setRootCause(cause);
        }

        // P0-06 closure gate: cannot close if any refund is unresolved/failed OR confirmed refund lacks finance verification
        if ("CLOSED".equalsIgnoreCase(ticket.getStatus())) {
            if (refundTransactionRepository != null) {
                List<RefundTransaction> txs = refundTransactionRepository.findByTicketNumberOrderByRequestedAtAsc(ticket.getTicketNumber());
                boolean hasUnresolved = txs.stream().anyMatch(tx ->
                        RefundStatus.REQUESTED.equalsIgnoreCase(tx.getStatus())
                                || RefundStatus.PENDING_CHANNEL.equalsIgnoreCase(tx.getStatus())
                                || RefundStatus.FAILED.equalsIgnoreCase(tx.getStatus()));
                if (hasUnresolved) {
                    throw new IllegalStateException("该售后工单仍有未确认或失败待重试的退款记录，须完成退款或人工核销后再结案。");
                }
                boolean hasConfirmed = txs.stream().anyMatch(tx -> RefundStatus.CONFIRMED.equalsIgnoreCase(tx.getStatus()));
                if (hasConfirmed && ticket.getFinanceVerifiedAt() == null) {
                    throw new IllegalStateException("该售后工单包含退款记录，须先由财务核对实际退款金额与流水后再结案。");
                }
            } else if (ticket.getRefundAmount() != null
                    && ticket.getRefundAmount().compareTo(BigDecimal.ZERO) > 0
                    && ticket.getFinanceVerifiedAt() == null) {
                throw new IllegalStateException("该售后工单包含退款记录，须先由财务核对实际退款金额与流水后再结案。");
            }
        }

        AfterSalesTicket saved = ticketRepository.save(ticket);
        auditLogService.log(adminEmail, "UPDATE_AFTER_SALES_TICKET", "AFTER_SALES", ticketNumber,
                "order=" + ticket.getOrderNumber() + "; status=" + previousStatus + "->" + saved.getStatus()
                        + "; assignee=" + saved.getAssignee()
                        + (saved.getReturnQcResult() != null ? "; returnQc=" + saved.getReturnQcResult() : "")
                        + (saved.getReturnDisposition() != null ? "; disposition=" + saved.getReturnDisposition() : "")
                        + (saved.getRemakeTrackingNumber() != null ? "; remakeTracking=" + saved.getRemakeTrackingNumber() : ""));
        return toDTO(saved, true);
    }

    /**
     * P0-07: Order-level + ticket-level idempotent QC-gated restock of a physically returned frame.
     * Prevents double-restocking the same physical pair across TWO separate tickets on the same order!
     */
    @Transactional
    public AfterSalesTicketResponseDTO restockReturnedItem(String ticketNumber, String adminEmail) {
        AfterSalesTicket ticket = ticketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketNumber));

        if (ticket.isReturnRestocked()) {
            return toDTO(ticket, true);
        }
        if (ticket.getReturnReceivedAt() == null) {
            throw new IllegalStateException("尚未登记退回实物签收记录，不可执行回库。");
        }
        if (!"RESTOCKABLE".equalsIgnoreCase(ticket.getReturnQcResult())) {
            throw new IllegalStateException("退回实物尚未经质检判定为「合格可回库 (RESTOCKABLE)」，不可入库。");
        }

        // Lock parent Order first so two tickets referencing the same physical item serialize cleanly
        Order order = orderRepository.findByOrderNumberWithWriteLock(ticket.getOrderNumber())
                .or(() -> orderRepository.findByOrderNumber(ticket.getOrderNumber()))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + ticket.getOrderNumber()));

        if (order.isReturnRestocked()) {
            if (ticketNumber.equals(order.getReturnRestockedByTicket())) {
                ticket.setReturnRestocked(true);
                return toDTO(ticketRepository.save(ticket), true);
            }
            throw new IllegalStateException("该订单对应的实物已由售后工单 " + order.getReturnRestockedByTicket()
                    + " 完成回库，同一件退货不可重复入库。");
        }

        Long productId = order.getProduct() != null ? order.getProduct().getId() : null;
        if (order.getSkuId() != null && productSkuRepository != null) {
            productSkuRepository.incrementOnHandStock(order.getSkuId());
            if (productId != null && productRepository != null) {
                Integer totalAvail = productSkuRepository.sumAvailableQtyByProductId(productId);
                if (totalAvail != null) {
                    productRepository.updateStockQuantity(productId, Math.max(0, totalAvail));
                }
            }
        } else if (productId != null && productRepository != null) {
            productRepository.incrementStock(productId);
        } else {
            throw new IllegalStateException("原订单缺少可回库的商品或 SKU 关联信息。");
        }
        if (cacheManager != null) {
            Cache cache = cacheManager.getCache("productCatalog");
            if (cache != null) {
                cache.clear();
            }
        }

        LocalDateTime now = BusinessClock.now();
        order.setReturnRestocked(true);
        order.setReturnRestockedByTicket(ticket.getTicketNumber());
        order.setReturnRestockedAt(now);
        orderRepository.save(order);

        ticket.setReturnRestocked(true);
        ticket.setReturnDisposition("RESTOCK");
        AfterSalesTicket saved = ticketRepository.save(ticket);
        auditLogService.log(adminEmail, "AFTER_SALES_RESTOCK", "AFTER_SALES", ticketNumber,
                "order=" + order.getOrderNumber() + "; skuId=" + order.getSkuId() + "; qc=RESTOCKABLE");
        return toDTO(saved, true);
    }

    @Transactional
    public AfterSalesTicketResponseDTO executePostShipmentRefund(
            String ticketNumber,
            BigDecimal refundAmount,
            String refundReason,
            String manualRefundTxId,
            String adminEmail) {
        return executePostShipmentRefund(ticketNumber, refundAmount, refundReason, manualRefundTxId, null, adminEmail);
    }

    /**
     * P0-06: Itemized post-shipment full or partial refund strictly separating requested vs confirmed amounts.
     * - Each distinct refund gets a unique refundRequestId (out_request_no) so multiple partial refunds never collide.
     * - Gateway failures are recorded as FAILED with confirmedAmount=null and NEVER inflate confirmed/order refund totals!
     * - Duplicate clicks with the same idempotencyRequestId return cleanly without double-refunding.
     */
    @Transactional
    public AfterSalesTicketResponseDTO executePostShipmentRefund(
            String ticketNumber,
            BigDecimal refundAmount,
            String refundReason,
            String manualRefundTxId,
            String idempotencyRequestId,
            String adminEmail) {
        if (refundAmount == null || refundAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("退款金额必须大于 0。");
        }
        AfterSalesTicket ticket = ticketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketNumber));
        Order order = orderRepository.findByOrderNumberWithWriteLock(ticket.getOrderNumber())
                .or(() -> orderRepository.findByOrderNumber(ticket.getOrderNumber()))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + ticket.getOrderNumber()));

        if (!OrderStatus.PAID.equalsIgnoreCase(order.getStatus())
                && !OrderStatus.SHIPPED.equalsIgnoreCase(order.getStatus())
                && !OrderStatus.DELIVERED.equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("仅已付款、已发货或已签收订单可执行售后退款（当前状态：" + order.getStatus() + "）。");
        }

        // Duplicate-click idempotency check
        String normalizedReqId = (idempotencyRequestId != null && !idempotencyRequestId.isBlank())
                ? idempotencyRequestId.trim()
                : null;
        if (normalizedReqId != null && refundTransactionRepository != null) {
            Optional<RefundTransaction> existing = refundTransactionRepository.findByRefundRequestId(normalizedReqId);
            if (existing.isPresent()) {
                return toDTO(ticket, true);
            }
        }

        // Calculate remaining refundable considering BOTH confirmed AND pending/failed requests
        BigDecimal alreadyConfirmed = order.getConfirmedRefundAmount().compareTo(BigDecimal.ZERO) > 0
                ? order.getConfirmedRefundAmount()
                : (refundTransactionRepository == null && order.getRefundAmount() != null ? order.getRefundAmount() : BigDecimal.ZERO);
        BigDecimal alreadyPending = order.getPendingRefundAmount();
        BigDecimal remainingRefundable = order.getTotalAmount().subtract(alreadyConfirmed).subtract(alreadyPending);
        if (refundAmount.compareTo(remainingRefundable) > 0) {
            throw new IllegalArgumentException("退款金额超出可退余额（可退：" + remainingRefundable.max(BigDecimal.ZERO).toPlainString() + "）。");
        }

        String effectiveReason = (refundReason != null && !refundReason.isBlank())
                ? refundReason.trim()
                : "售后工单退款：" + ticket.getTicketNumber();

        int nextSeq = refundTransactionRepository != null
                ? refundTransactionRepository.findByOrderNumberOrderByRequestedAtAsc(order.getOrderNumber()).size() + 1
                : 1;
        String refundRequestId = normalizedReqId != null
                ? normalizedReqId
                : order.getOrderNumber() + "-RF-" + ticket.getTicketNumber() + "-" + nextSeq;

        LocalDateTime now = BusinessClock.now();
        boolean isManualConfirmed = manualRefundTxId != null && !manualRefundTxId.isBlank();
        RefundResult gatewayResult;

        if (isManualConfirmed) {
            gatewayResult = RefundResult.confirmed(manualRefundTxId.trim(), refundAmount);
        } else if (paymentService != null && order.getPaymentChannel() != null && !order.getPaymentChannel().isBlank()) {
            try {
                gatewayResult = invokeGatewayRefund(
                        order.getOrderNumber(),
                        order.getGatewayTransactionId(),
                        refundAmount,
                        order.getPaymentChannel(),
                        effectiveReason,
                        refundRequestId);
            } catch (Exception e) {
                gatewayResult = RefundResult.failed(e.getMessage());
            }
        } else {
            gatewayResult = RefundResult.failed("支付渠道未配置，请核实后重试或财务人工打款核销");
        }

        RefundTransaction tx = new RefundTransaction();
        tx.setRefundRequestId(refundRequestId);
        tx.setOrderNumber(order.getOrderNumber());
        tx.setTicketNumber(ticket.getTicketNumber());
        tx.setRequestedAmount(refundAmount);
        tx.setPaymentChannel(order.getPaymentChannel());
        tx.setReason(effectiveReason);
        tx.setRequestedBy(adminEmail);
        tx.setRequestedAt(now);

        if (gatewayResult.confirmed()) {
            BigDecimal confirmedAmt = gatewayResult.confirmedAmount() != null ? gatewayResult.confirmedAmount() : refundAmount;
            tx.setStatus(RefundStatus.CONFIRMED);
            tx.setConfirmedAmount(confirmedAmt);
            tx.setConfirmedAt(now);
            tx.setGatewayRefundId(gatewayResult.gatewayRefundId());
            if (isManualConfirmed) {
                tx.setManualVoucherRef(manualRefundTxId.trim());
            }
        } else {
            tx.setStatus(RefundStatus.FAILED);
            tx.setConfirmedAmount(null);
            tx.setConfirmedAt(null);
            tx.setFailureMessage(gatewayResult.message());
        }

        if (refundTransactionRepository != null) {
            refundTransactionRepository.save(tx);
            syncOrderAndTicketRefundTotals(order, ticket);
        } else {
            // Fallback when RefundTransactionRepository is not wired in legacy lightweight mocks:
            // STILL strictly enforce P0-06 — FAILED gateway call must NEVER add to confirmed/order refundAmount!
            if (gatewayResult.confirmed()) {
                BigDecimal nextConfirmed = alreadyConfirmed.add(refundAmount);
                order.setConfirmedRefundAmount(nextConfirmed);
                order.setRefundAmount(nextConfirmed);
                order.setRefundRequestId(gatewayResult.gatewayRefundId());
                if (nextConfirmed.compareTo(order.getTotalAmount()) >= 0) {
                    order.setStatus(OrderStatus.REFUNDED);
                }
                BigDecimal prevTicketRefund = ticket.getRefundAmount() != null ? ticket.getRefundAmount() : BigDecimal.ZERO;
                ticket.setRefundAmount(prevTicketRefund.add(refundAmount));
                ticket.setRefundTransactionId(gatewayResult.gatewayRefundId());
            } else {
                order.setPendingRefundAmount(alreadyPending.add(refundAmount));
                order.setRefundRequestId(refundRequestId);
            }
        }

        order.setRefundReason(effectiveReason);
        orderRepository.save(order);

        if ("OPEN".equalsIgnoreCase(ticket.getStatus())) {
            ticket.setStatus("IN_PROGRESS");
        }
        AfterSalesTicket saved = ticketRepository.save(ticket);

        auditLogService.log(adminEmail, "AFTER_SALES_REFUND", "AFTER_SALES", ticketNumber,
                "order=" + order.getOrderNumber() + "; requestId=" + refundRequestId
                        + "; requested=" + refundAmount.toPlainString()
                        + "; status=" + tx.getStatus()
                        + (tx.getGatewayRefundId() != null ? "; gwRef=" + tx.getGatewayRefundId() : ""));
        return toDTO(saved, true);
    }

    /**
     * P0-06: Retry a failed or pending refund transaction using its EXACT original refundRequestId (out_request_no).
     */
    @Transactional
    public OrderDetailResponseDTO.RefundTransactionDTO retryRefundTransaction(String refundRequestId, String operatorEmail) {
        if (refundTransactionRepository == null) {
            throw new IllegalStateException("Refund ledger repository is not configured.");
        }
        RefundTransaction tx = refundTransactionRepository.findByRefundRequestId(refundRequestId)
                .orElseThrow(() -> new IllegalArgumentException("Refund transaction not found: " + refundRequestId));

        if (RefundStatus.CONFIRMED.equalsIgnoreCase(tx.getStatus())) {
            return toRefundTxDTO(tx, true);
        }
        if (!RefundStatus.FAILED.equalsIgnoreCase(tx.getStatus())
                && !RefundStatus.PENDING_CHANNEL.equalsIgnoreCase(tx.getStatus())
                && !RefundStatus.REQUESTED.equalsIgnoreCase(tx.getStatus())) {
            throw new IllegalStateException("当前退款状态（" + tx.getStatus() + "）不支持重试。");
        }

        Order order = orderRepository.findByOrderNumberWithWriteLock(tx.getOrderNumber())
                .or(() -> orderRepository.findByOrderNumber(tx.getOrderNumber()))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + tx.getOrderNumber()));

        RefundResult result;
        if (paymentService != null && order.getPaymentChannel() != null && !order.getPaymentChannel().isBlank()) {
            try {
                result = invokeGatewayRefund(
                        order.getOrderNumber(),
                        order.getGatewayTransactionId(),
                        tx.getRequestedAmount(),
                        order.getPaymentChannel(),
                        tx.getReason() != null ? tx.getReason() : "Refund retry",
                        tx.getRefundRequestId() // Reuse EXACT same out_request_no on retry!
                );
            } catch (Exception e) {
                result = RefundResult.failed(e.getMessage());
            }
        } else {
            result = RefundResult.failed("支付渠道未配置");
        }

        if (result.confirmed()) {
            tx.setStatus(RefundStatus.CONFIRMED);
            tx.setConfirmedAmount(result.confirmedAmount() != null ? result.confirmedAmount() : tx.getRequestedAmount());
            tx.setConfirmedAt(BusinessClock.now());
            tx.setGatewayRefundId(result.gatewayRefundId());
            tx.setFailureMessage(null);
        } else {
            tx.setStatus(RefundStatus.FAILED);
            tx.setFailureMessage(result.message());
        }
        refundTransactionRepository.save(tx);

        AfterSalesTicket ticket = (tx.getTicketNumber() != null)
                ? ticketRepository.findByTicketNumber(tx.getTicketNumber()).orElse(null)
                : null;
        syncOrderAndTicketRefundTotals(order, ticket);
        orderRepository.save(order);
        if (ticket != null) {
            ticketRepository.save(ticket);
        }

        auditLogService.log(operatorEmail != null ? operatorEmail : "scheduler", "RETRY_REFUND_TX", "REFUND", refundRequestId,
                "order=" + order.getOrderNumber() + "; status=" + tx.getStatus());
        return toRefundTxDTO(tx, true);
    }

    /**
     * P0-06: Finance manual takeover & confirmation of a failed/pending refund with mandatory voucher ref.
     */
    @Transactional
    public OrderDetailResponseDTO.RefundTransactionDTO manualConfirmRefundTransaction(
            String refundRequestId,
            BigDecimal confirmedAmount,
            String manualVoucherRef,
            String note,
            String financeEmail) {
        if (refundTransactionRepository == null) {
            throw new IllegalStateException("Refund ledger repository is not configured.");
        }
        if (manualVoucherRef == null || manualVoucherRef.isBlank() || manualVoucherRef.trim().startsWith("PENDING-")) {
            throw new IllegalArgumentException("人工核销退款必须提供真实有效的银行/渠道退款流水或凭证号。");
        }
        RefundTransaction tx = refundTransactionRepository.findByRefundRequestId(refundRequestId)
                .orElseThrow(() -> new IllegalArgumentException("Refund transaction not found: " + refundRequestId));

        BigDecimal effectiveConfirmed = confirmedAmount != null ? confirmedAmount : tx.getRequestedAmount();
        if (effectiveConfirmed == null || effectiveConfirmed.compareTo(BigDecimal.ZERO) <= 0
                || effectiveConfirmed.compareTo(tx.getRequestedAmount()) > 0) {
            throw new IllegalArgumentException("确认退款金额必须大于 0 且不超过申请退款金额（" + tx.getRequestedAmount() + "）。");
        }

        Order order = orderRepository.findByOrderNumberWithWriteLock(tx.getOrderNumber())
                .or(() -> orderRepository.findByOrderNumber(tx.getOrderNumber()))
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + tx.getOrderNumber()));

        LocalDateTime now = BusinessClock.now();
        tx.setStatus(RefundStatus.CONFIRMED);
        tx.setConfirmedAmount(effectiveConfirmed);
        tx.setConfirmedAt(now);
        tx.setManualVoucherRef(manualVoucherRef.trim());
        tx.setGatewayRefundId(manualVoucherRef.trim());
        tx.setFailureMessage(null);
        tx.setFinanceVerifiedBy(financeEmail);
        tx.setFinanceVerifiedAt(now);
        refundTransactionRepository.save(tx);

        AfterSalesTicket ticket = (tx.getTicketNumber() != null)
                ? ticketRepository.findByTicketNumber(tx.getTicketNumber()).orElse(null)
                : null;
        syncOrderAndTicketRefundTotals(order, ticket);
        orderRepository.save(order);
        if (ticket != null) {
            if (note != null && !note.isBlank()) {
                String prev = ticket.getResolutionNote();
                String appended = "[财务人工核销] " + note.trim();
                ticket.setResolutionNote(prev != null && !prev.isBlank() ? prev + " | " + appended : appended);
            }
            ticketRepository.save(ticket);
        }

        auditLogService.log(financeEmail, "MANUAL_CONFIRM_REFUND", "REFUND", refundRequestId,
                "order=" + order.getOrderNumber() + "; confirmed=" + effectiveConfirmed.toPlainString()
                        + "; voucher=" + manualVoucherRef.trim());
        return toRefundTxDTO(tx, true);
    }

    /**
     * P0-06: Finance sign-off strictly requires a real non-blank confirmed refund transaction ID / voucher.
     */
    @Transactional
    public AfterSalesTicketResponseDTO financeVerifyTicketRefund(
            String ticketNumber,
            String refundTransactionId,
            String note,
            String financeEmail) {
        AfterSalesTicket ticket = ticketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketNumber));

        if (refundTransactionId == null || refundTransactionId.isBlank()
                || refundTransactionId.trim().startsWith("PENDING-")) {
            throw new IllegalArgumentException("财务核对必须录入真实有效的渠道退款流水号或人工打款凭证号，不可留空。");
        }

        if (refundTransactionRepository != null) {
            List<RefundTransaction> txs = refundTransactionRepository.findByTicketNumberOrderByRequestedAtAsc(ticket.getTicketNumber());
            boolean hasUnresolved = txs.stream().anyMatch(tx ->
                    RefundStatus.REQUESTED.equalsIgnoreCase(tx.getStatus())
                            || RefundStatus.PENDING_CHANNEL.equalsIgnoreCase(tx.getStatus())
                            || RefundStatus.FAILED.equalsIgnoreCase(tx.getStatus()));
            if (hasUnresolved) {
                throw new IllegalStateException("该工单存在待确认或失败的退款流水，请先重试或人工核销后再完成财务核对。");
            }
            List<RefundTransaction> confirmedTxs = txs.stream()
                    .filter(tx -> RefundStatus.CONFIRMED.equalsIgnoreCase(tx.getStatus()))
                    .toList();
            if (confirmedTxs.isEmpty()) {
                throw new IllegalStateException("该工单尚无已确认到账的退款流水，无法进行财务核对。");
            }
            LocalDateTime now = BusinessClock.now();
            for (RefundTransaction ctx : confirmedTxs) {
                if (ctx.getGatewayRefundId() == null || ctx.getGatewayRefundId().isBlank()) {
                    ctx.setGatewayRefundId(refundTransactionId.trim());
                }
                ctx.setFinanceVerifiedBy(financeEmail);
                ctx.setFinanceVerifiedAt(now);
                refundTransactionRepository.save(ctx);
            }
        } else if (ticket.getRefundAmount() == null || ticket.getRefundAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("该工单尚无已确认退款记录，无需财务核对。");
        }

        ticket.setRefundTransactionId(refundTransactionId.trim());
        ticket.setFinanceVerifiedBy(financeEmail);
        ticket.setFinanceVerifiedAt(BusinessClock.now());
        if (note != null && !note.isBlank()) {
            String prev = ticket.getResolutionNote();
            String appended = "[财务核对] " + note.trim();
            ticket.setResolutionNote(prev != null && !prev.isBlank() ? prev + " | " + appended : appended);
        }
        AfterSalesTicket saved = ticketRepository.save(ticket);
        auditLogService.log(financeEmail, "FINANCE_VERIFY_REFUND", "AFTER_SALES", ticketNumber,
                "order=" + ticket.getOrderNumber() + "; refundAmount=" + ticket.getRefundAmount()
                        + "; txId=" + ticket.getRefundTransactionId());
        return toDTO(saved, true);
    }

    private void syncOrderAndTicketRefundTotals(Order order, AfterSalesTicket ticket) {
        if (refundTransactionRepository == null) return;
        List<RefundTransaction> orderTxs = refundTransactionRepository.findByOrderNumberOrderByRequestedAtAsc(order.getOrderNumber());
        BigDecimal orderConfirmed = BigDecimal.ZERO;
        BigDecimal orderPending = BigDecimal.ZERO;
        String latestConfirmedRef = null;
        for (RefundTransaction item : orderTxs) {
            if (RefundStatus.CONFIRMED.equalsIgnoreCase(item.getStatus())) {
                BigDecimal amt = item.getConfirmedAmount() != null ? item.getConfirmedAmount() : item.getRequestedAmount();
                if (amt != null) orderConfirmed = orderConfirmed.add(amt);
                if (item.getGatewayRefundId() != null) latestConfirmedRef = item.getGatewayRefundId();
            } else if (RefundStatus.REQUESTED.equalsIgnoreCase(item.getStatus())
                    || RefundStatus.PENDING_CHANNEL.equalsIgnoreCase(item.getStatus())
                    || RefundStatus.FAILED.equalsIgnoreCase(item.getStatus())) {
                if (item.getRequestedAmount() != null) orderPending = orderPending.add(item.getRequestedAmount());
            }
        }
        order.setConfirmedRefundAmount(orderConfirmed);
        order.setPendingRefundAmount(orderPending);
        order.setRefundAmount(orderConfirmed.compareTo(BigDecimal.ZERO) > 0 ? orderConfirmed : null);
        if (latestConfirmedRef != null) {
            order.setRefundRequestId(latestConfirmedRef);
        }
        if (orderConfirmed.compareTo(order.getTotalAmount()) >= 0 && order.getTotalAmount().compareTo(BigDecimal.ZERO) > 0) {
            order.setStatus(OrderStatus.REFUNDED);
        }

        if (ticket != null) {
            List<RefundTransaction> ticketTxs = refundTransactionRepository.findByTicketNumberOrderByRequestedAtAsc(ticket.getTicketNumber());
            BigDecimal ticketConfirmed = BigDecimal.ZERO;
            String lastRef = null;
            for (RefundTransaction item : ticketTxs) {
                if (RefundStatus.CONFIRMED.equalsIgnoreCase(item.getStatus())) {
                    BigDecimal amt = item.getConfirmedAmount() != null ? item.getConfirmedAmount() : item.getRequestedAmount();
                    if (amt != null) ticketConfirmed = ticketConfirmed.add(amt);
                    if (item.getGatewayRefundId() != null) lastRef = item.getGatewayRefundId();
                }
            }
            ticket.setRefundAmount(ticketConfirmed.compareTo(BigDecimal.ZERO) > 0 ? ticketConfirmed : null);
            if (lastRef != null) {
                ticket.setRefundTransactionId(lastRef);
            }
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

    private String blankToNull(String value) {
        return value.trim().isEmpty() ? null : value.trim();
    }

    private OrderDetailResponseDTO.RefundTransactionDTO toRefundTxDTO(RefundTransaction tx, boolean includeInternal) {
        return new OrderDetailResponseDTO.RefundTransactionDTO(
                tx.getRefundRequestId(),
                tx.getTicketNumber(),
                tx.getRequestedAmount(),
                tx.getConfirmedAmount(),
                tx.getStatus(),
                tx.getPaymentChannel(),
                tx.getGatewayRefundId(),
                tx.getManualVoucherRef(),
                tx.getReason(),
                includeInternal ? tx.getFailureMessage() : null,
                tx.getRequestedAt(),
                tx.getConfirmedAt(),
                includeInternal ? tx.getFinanceVerifiedBy() : null,
                tx.getFinanceVerifiedAt()
        );
    }

    private AfterSalesTicketResponseDTO toDTO(AfterSalesTicket t, boolean includeInternal) {
        List<RefundTransaction> rawTxs = refundTransactionRepository != null
                ? refundTransactionRepository.findByTicketNumberOrderByRequestedAtAsc(t.getTicketNumber())
                : List.of();
        BigDecimal confirmedSum = BigDecimal.ZERO;
        BigDecimal pendingSum = BigDecimal.ZERO;
        for (RefundTransaction tx : rawTxs) {
            if (RefundStatus.CONFIRMED.equalsIgnoreCase(tx.getStatus())) {
                BigDecimal amt = tx.getConfirmedAmount() != null ? tx.getConfirmedAmount() : tx.getRequestedAmount();
                if (amt != null) confirmedSum = confirmedSum.add(amt);
            } else if (RefundStatus.REQUESTED.equalsIgnoreCase(tx.getStatus())
                    || RefundStatus.PENDING_CHANNEL.equalsIgnoreCase(tx.getStatus())
                    || RefundStatus.FAILED.equalsIgnoreCase(tx.getStatus())) {
                if (tx.getRequestedAmount() != null) pendingSum = pendingSum.add(tx.getRequestedAmount());
            }
        }
        if (rawTxs.isEmpty() && t.getRefundAmount() != null) {
            confirmedSum = t.getRefundAmount();
        }
        List<OrderDetailResponseDTO.RefundTransactionDTO> txDtos = rawTxs.stream()
                .map(tx -> toRefundTxDTO(tx, includeInternal))
                .toList();

        // P0-10: Strip internal staff/cost/root-cause/internal QC notes from customer responses
        return new AfterSalesTicketResponseDTO(
                t.getTicketNumber(),
                t.getOrderNumber(),
                t.getCategory(),
                t.getReason(),
                t.getContactInfo(),
                t.getStatus(),
                includeInternal ? t.getAssignee() : null,
                t.getResolutionNote(),
                t.getNextContactAt(),
                t.getCreatedAt(),
                t.getUpdatedAt(),
                t.getReturnCarrier(),
                t.getReturnTrackingNumber(),
                t.getReturnReceivedAt(),
                t.getReturnQcResult(),
                includeInternal ? t.getReturnQcNote() : null,
                t.isReturnRestocked(),
                t.getRemakeOrderNumber(),
                t.getRemakeCarrier(),
                t.getRemakeTrackingNumber(),
                t.getRefundAmount(),
                t.getRefundTransactionId(),
                includeInternal ? t.getFinanceVerifiedBy() : null,
                t.getFinanceVerifiedAt(),
                includeInternal ? t.getRootCause() : null,
                includeInternal ? t.getReturnReceivedBy() : null,
                includeInternal ? t.getReturnQcCheckedBy() : null,
                t.getReturnQcCheckedAt(),
                t.getReturnDisposition(),
                includeInternal ? t.getReturnEvidenceNote() : null,
                includeInternal ? t.getRemakeCostAmount() : null,
                includeInternal ? t.getReturnShippingCost() : null,
                confirmedSum,
                pendingSum,
                txDtos
        );
    }
}
