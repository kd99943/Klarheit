package com.klarheit.backend.payment;

import com.klarheit.backend.order.BusinessClock;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "refund_transactions")
public class RefundTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "refund_request_id", nullable = false, unique = true, length = 128)
    private String refundRequestId;

    @Column(name = "order_number", nullable = false, length = 64)
    private String orderNumber;

    @Column(name = "ticket_number", length = 64)
    private String ticketNumber;

    @Column(name = "requested_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal requestedAmount;

    @Column(name = "confirmed_amount", precision = 10, scale = 2)
    private BigDecimal confirmedAmount;

    @Column(nullable = false, length = 32)
    private String status = RefundStatus.REQUESTED;

    @Column(name = "payment_channel", length = 32)
    private String paymentChannel;

    @Column(name = "gateway_refund_id", length = 128)
    private String gatewayRefundId;

    @Column(name = "manual_voucher_ref", length = 128)
    private String manualVoucherRef;

    @Column(length = 512)
    private String reason;

    @Column(name = "failure_message", length = 512)
    private String failureMessage;

    @Column(name = "requested_by", length = 120)
    private String requestedBy;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "finance_verified_by", length = 120)
    private String financeVerifiedBy;

    @Column(name = "finance_verified_at")
    private LocalDateTime financeVerifiedAt;

    @PrePersist
    protected void onCreate() {
        if (requestedAt == null) {
            requestedAt = BusinessClock.now();
        }
        if (status == null || status.isBlank()) {
            status = RefundStatus.REQUESTED;
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRefundRequestId() { return refundRequestId; }
    public void setRefundRequestId(String refundRequestId) { this.refundRequestId = refundRequestId; }
    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
    public String getTicketNumber() { return ticketNumber; }
    public void setTicketNumber(String ticketNumber) { this.ticketNumber = ticketNumber; }
    public BigDecimal getRequestedAmount() { return requestedAmount; }
    public void setRequestedAmount(BigDecimal requestedAmount) { this.requestedAmount = requestedAmount; }
    public BigDecimal getConfirmedAmount() { return confirmedAmount; }
    public void setConfirmedAmount(BigDecimal confirmedAmount) { this.confirmedAmount = confirmedAmount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getPaymentChannel() { return paymentChannel; }
    public void setPaymentChannel(String paymentChannel) { this.paymentChannel = paymentChannel; }
    public String getGatewayRefundId() { return gatewayRefundId; }
    public void setGatewayRefundId(String gatewayRefundId) { this.gatewayRefundId = gatewayRefundId; }
    public String getManualVoucherRef() { return manualVoucherRef; }
    public void setManualVoucherRef(String manualVoucherRef) { this.manualVoucherRef = manualVoucherRef; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getFailureMessage() { return failureMessage; }
    public void setFailureMessage(String failureMessage) { this.failureMessage = failureMessage; }
    public String getRequestedBy() { return requestedBy; }
    public void setRequestedBy(String requestedBy) { this.requestedBy = requestedBy; }
    public LocalDateTime getRequestedAt() { return requestedAt; }
    public void setRequestedAt(LocalDateTime requestedAt) { this.requestedAt = requestedAt; }
    public LocalDateTime getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(LocalDateTime confirmedAt) { this.confirmedAt = confirmedAt; }
    public String getFinanceVerifiedBy() { return financeVerifiedBy; }
    public void setFinanceVerifiedBy(String financeVerifiedBy) { this.financeVerifiedBy = financeVerifiedBy; }
    public LocalDateTime getFinanceVerifiedAt() { return financeVerifiedAt; }
    public void setFinanceVerifiedAt(LocalDateTime financeVerifiedAt) { this.financeVerifiedAt = financeVerifiedAt; }
}
