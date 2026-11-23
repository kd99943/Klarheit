package com.klarheit.backend.aftersales;

import com.klarheit.backend.aftersales.dto.AfterSalesTicketRequestDTO;
import com.klarheit.backend.aftersales.dto.AfterSalesTicketResponseDTO;
import com.klarheit.backend.aftersales.dto.AfterSalesTicketUpdateDTO;
import com.klarheit.backend.order.dto.OrderDetailResponseDTO;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AfterSalesController {
    private final AfterSalesService afterSalesService;

    public AfterSalesController(AfterSalesService afterSalesService) {
        this.afterSalesService = afterSalesService;
    }

    @PostMapping("/api/v1/orders/{orderNumber}/after-sales")
    public ResponseEntity<AfterSalesTicketResponseDTO> createTicket(
            @PathVariable String orderNumber,
            @Valid @RequestBody AfterSalesTicketRequestDTO request,
            Authentication authentication) {
        return ResponseEntity.ok(afterSalesService.createTicket(orderNumber, request, authentication.getName()));
    }

    @GetMapping("/api/v1/orders/{orderNumber}/after-sales")
    public ResponseEntity<List<AfterSalesTicketResponseDTO>> getOrderTickets(
            @PathVariable String orderNumber,
            Authentication authentication) {
        return ResponseEntity.ok(afterSalesService.getTicketsForOrder(orderNumber, authentication.getName()));
    }

    @GetMapping("/api/v1/admin/after-sales")
    public ResponseEntity<Page<AfterSalesTicketResponseDTO>> getAllTicketsForAdmin(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(afterSalesService.getAllTicketsForAdmin(status, pageable));
    }

    @PutMapping("/api/v1/admin/after-sales/{ticketNumber}")
    public ResponseEntity<AfterSalesTicketResponseDTO> updateTicketForAdmin(
            @PathVariable String ticketNumber,
            @Valid @RequestBody AfterSalesTicketUpdateDTO request,
            Authentication authentication) {
        return ResponseEntity.ok(afterSalesService.updateTicketForAdmin(ticketNumber, request, authentication.getName()));
    }

    @PostMapping("/api/v1/admin/after-sales/{ticketNumber}/restock")
    public ResponseEntity<AfterSalesTicketResponseDTO> restockReturnedItem(
            @PathVariable String ticketNumber,
            Authentication authentication) {
        return ResponseEntity.ok(afterSalesService.restockReturnedItem(ticketNumber, authentication.getName()));
    }

    @PostMapping("/api/v1/admin/after-sales/{ticketNumber}/refund")
    public ResponseEntity<AfterSalesTicketResponseDTO> executeRefund(
            @PathVariable String ticketNumber,
            @RequestBody Map<String, Object> body,
            Authentication authentication) {
        Object amtRaw = body.get("refundAmount");
        BigDecimal refundAmount = amtRaw != null && !String.valueOf(amtRaw).isBlank()
                ? new BigDecimal(String.valueOf(amtRaw).trim())
                : null;
        String reason = body.get("refundReason") != null ? String.valueOf(body.get("refundReason")) : null;
        String txId = body.get("refundTransactionId") != null ? String.valueOf(body.get("refundTransactionId")) : null;
        String reqId = body.get("refundRequestId") != null
                ? String.valueOf(body.get("refundRequestId"))
                : (body.get("idempotencyRequestId") != null ? String.valueOf(body.get("idempotencyRequestId")) : null);
        return ResponseEntity.ok(afterSalesService.executePostShipmentRefund(
                ticketNumber, refundAmount, reason, txId, reqId, authentication.getName()));
    }

    @PostMapping("/api/v1/admin/after-sales/{ticketNumber}/finance-verify")
    public ResponseEntity<AfterSalesTicketResponseDTO> financeVerify(
            @PathVariable String ticketNumber,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication) {
        String txId = body != null ? body.get("refundTransactionId") : null;
        String note = body != null ? body.get("note") : null;
        return ResponseEntity.ok(afterSalesService.financeVerifyTicketRefund(
                ticketNumber, txId, note, authentication.getName()));
    }

    @PostMapping("/api/v1/admin/refunds/{refundRequestId}/retry")
    public ResponseEntity<OrderDetailResponseDTO.RefundTransactionDTO> retryRefundTransaction(
            @PathVariable String refundRequestId,
            Authentication authentication) {
        return ResponseEntity.ok(afterSalesService.retryRefundTransaction(refundRequestId, authentication.getName()));
    }

    @PostMapping("/api/v1/admin/refunds/{refundRequestId}/manual-confirm")
    public ResponseEntity<OrderDetailResponseDTO.RefundTransactionDTO> manualConfirmRefundTransaction(
            @PathVariable String refundRequestId,
            @RequestBody Map<String, Object> body,
            Authentication authentication) {
        Object amtRaw = body.get("confirmedAmount");
        BigDecimal confirmedAmount = amtRaw != null && !String.valueOf(amtRaw).isBlank()
                ? new BigDecimal(String.valueOf(amtRaw).trim())
                : null;
        String voucherRef = body.get("manualVoucherRef") != null
                ? String.valueOf(body.get("manualVoucherRef"))
                : (body.get("refundTransactionId") != null ? String.valueOf(body.get("refundTransactionId")) : null);
        String note = body.get("note") != null ? String.valueOf(body.get("note")) : null;
        return ResponseEntity.ok(afterSalesService.manualConfirmRefundTransaction(
                refundRequestId, confirmedAmount, voucherRef, note, authentication.getName()));
    }
}
