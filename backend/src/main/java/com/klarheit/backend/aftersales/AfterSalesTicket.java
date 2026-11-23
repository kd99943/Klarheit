package com.klarheit.backend.aftersales;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "after_sales_tickets")
public class AfterSalesTicket {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_number", nullable = false, unique = true, length = 64)
    private String ticketNumber;

    @Column(name = "order_number", nullable = false, length = 64)
    private String orderNumber;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 32)
    private String category;

    @Column(nullable = false, length = 1000)
    private String reason;

    @Column(name = "contact_info", length = 255)
    private String contactInfo;

    @Column(nullable = false, length = 32)
    private String status = "OPEN";

    @Column(length = 120)
    private String assignee;

    @Column(name = "resolution_note", length = 1000)
    private String resolutionNote;

    @Column(name = "next_contact_at")
    private LocalDateTime nextContactAt;

    @Column(name = "return_carrier", length = 100)
    private String returnCarrier;

    @Column(name = "return_tracking_number", length = 100)
    private String returnTrackingNumber;

    @Column(name = "return_received_at")
    private LocalDateTime returnReceivedAt;

    @Column(name = "return_qc_result", length = 32)
    private String returnQcResult;

    @Column(name = "return_qc_note", length = 512)
    private String returnQcNote;

    @Column(name = "return_restocked", nullable = false)
    private boolean returnRestocked = false;

    @Column(name = "remake_order_number", length = 64)
    private String remakeOrderNumber;

    @Column(name = "remake_carrier", length = 100)
    private String remakeCarrier;

    @Column(name = "remake_tracking_number", length = 100)
    private String remakeTrackingNumber;

    @Column(name = "refund_amount", precision = 10, scale = 2)
    private BigDecimal refundAmount;

    @Column(name = "refund_transaction_id", length = 128)
    private String refundTransactionId;

    @Column(name = "finance_verified_by", length = 120)
    private String financeVerifiedBy;

    @Column(name = "finance_verified_at")
    private LocalDateTime financeVerifiedAt;

    @Column(name = "root_cause", length = 64)
    private String rootCause;

    @Column(name = "return_received_by", length = 120)
    private String returnReceivedBy;

    @Column(name = "return_qc_checked_by", length = 120)
    private String returnQcCheckedBy;

    @Column(name = "return_qc_checked_at")
    private LocalDateTime returnQcCheckedAt;

    @Column(name = "return_disposition", length = 64)
    private String returnDisposition;

    @Column(name = "return_evidence_note", length = 512)
    private String returnEvidenceNote;

    @Column(name = "remake_cost_amount", precision = 10, scale = 2)
    private BigDecimal remakeCostAmount;

    @Column(name = "return_shipping_cost", precision = 10, scale = 2)
    private BigDecimal returnShippingCost;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (status == null || status.isBlank()) status = "OPEN";
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTicketNumber() { return ticketNumber; }
    public void setTicketNumber(String ticketNumber) { this.ticketNumber = ticketNumber; }
    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getContactInfo() { return contactInfo; }
    public void setContactInfo(String contactInfo) { this.contactInfo = contactInfo; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAssignee() { return assignee; }
    public void setAssignee(String assignee) { this.assignee = assignee; }
    public String getResolutionNote() { return resolutionNote; }
    public void setResolutionNote(String resolutionNote) { this.resolutionNote = resolutionNote; }
    public LocalDateTime getNextContactAt() { return nextContactAt; }
    public void setNextContactAt(LocalDateTime nextContactAt) { this.nextContactAt = nextContactAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public String getReturnCarrier() { return returnCarrier; }
    public void setReturnCarrier(String returnCarrier) { this.returnCarrier = returnCarrier; }
    public String getReturnTrackingNumber() { return returnTrackingNumber; }
    public void setReturnTrackingNumber(String returnTrackingNumber) { this.returnTrackingNumber = returnTrackingNumber; }
    public LocalDateTime getReturnReceivedAt() { return returnReceivedAt; }
    public void setReturnReceivedAt(LocalDateTime returnReceivedAt) { this.returnReceivedAt = returnReceivedAt; }
    public String getReturnQcResult() { return returnQcResult; }
    public void setReturnQcResult(String returnQcResult) { this.returnQcResult = returnQcResult; }
    public String getReturnQcNote() { return returnQcNote; }
    public void setReturnQcNote(String returnQcNote) { this.returnQcNote = returnQcNote; }
    public boolean isReturnRestocked() { return returnRestocked; }
    public void setReturnRestocked(boolean returnRestocked) { this.returnRestocked = returnRestocked; }
    public String getRemakeOrderNumber() { return remakeOrderNumber; }
    public void setRemakeOrderNumber(String remakeOrderNumber) { this.remakeOrderNumber = remakeOrderNumber; }
    public String getRemakeCarrier() { return remakeCarrier; }
    public void setRemakeCarrier(String remakeCarrier) { this.remakeCarrier = remakeCarrier; }
    public String getRemakeTrackingNumber() { return remakeTrackingNumber; }
    public void setRemakeTrackingNumber(String remakeTrackingNumber) { this.remakeTrackingNumber = remakeTrackingNumber; }
    public BigDecimal getRefundAmount() { return refundAmount; }
    public void setRefundAmount(BigDecimal refundAmount) { this.refundAmount = refundAmount; }
    public String getRefundTransactionId() { return refundTransactionId; }
    public void setRefundTransactionId(String refundTransactionId) { this.refundTransactionId = refundTransactionId; }
    public String getFinanceVerifiedBy() { return financeVerifiedBy; }
    public void setFinanceVerifiedBy(String financeVerifiedBy) { this.financeVerifiedBy = financeVerifiedBy; }
    public LocalDateTime getFinanceVerifiedAt() { return financeVerifiedAt; }
    public void setFinanceVerifiedAt(LocalDateTime financeVerifiedAt) { this.financeVerifiedAt = financeVerifiedAt; }
    public String getRootCause() { return rootCause; }
    public void setRootCause(String rootCause) { this.rootCause = rootCause; }
    public String getReturnReceivedBy() { return returnReceivedBy; }
    public void setReturnReceivedBy(String returnReceivedBy) { this.returnReceivedBy = returnReceivedBy; }
    public String getReturnQcCheckedBy() { return returnQcCheckedBy; }
    public void setReturnQcCheckedBy(String returnQcCheckedBy) { this.returnQcCheckedBy = returnQcCheckedBy; }
    public LocalDateTime getReturnQcCheckedAt() { return returnQcCheckedAt; }
    public void setReturnQcCheckedAt(LocalDateTime returnQcCheckedAt) { this.returnQcCheckedAt = returnQcCheckedAt; }
    public String getReturnDisposition() { return returnDisposition; }
    public void setReturnDisposition(String returnDisposition) { this.returnDisposition = returnDisposition; }
    public String getReturnEvidenceNote() { return returnEvidenceNote; }
    public void setReturnEvidenceNote(String returnEvidenceNote) { this.returnEvidenceNote = returnEvidenceNote; }
    public BigDecimal getRemakeCostAmount() { return remakeCostAmount; }
    public void setRemakeCostAmount(BigDecimal remakeCostAmount) { this.remakeCostAmount = remakeCostAmount; }
    public BigDecimal getReturnShippingCost() { return returnShippingCost; }
    public void setReturnShippingCost(BigDecimal returnShippingCost) { this.returnShippingCost = returnShippingCost; }
}
