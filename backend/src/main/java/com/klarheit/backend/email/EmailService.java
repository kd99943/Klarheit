package com.klarheit.backend.email;

import com.klarheit.backend.order.BusinessClock;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

@Service
public class EmailService {
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_API_URL = "https://api.resend.com/emails";
    private static final DateTimeFormatter DISPLAY_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final RestClient restClient;
    private final String apiKey;
    private final String fromEmail;

    @Autowired(required = false)
    private EmailNotificationLogRepository notificationLogRepository;

    public EmailService(
            RestClient.Builder restClientBuilder,
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from-email:orders@klarheit.com}") String fromEmail) {
        this.restClient = restClientBuilder.baseUrl(RESEND_API_URL).build();
        this.apiKey = apiKey;
        this.fromEmail = fromEmail;
    }

    public void setNotificationLogRepository(EmailNotificationLogRepository notificationLogRepository) {
        this.notificationLogRepository = notificationLogRepository;
    }

    @Async
    @Retryable(
        retryFor = { ResourceAccessException.class, org.springframework.web.client.HttpServerErrorException.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 2000, multiplier = 2.0)
    )
    public void sendOrderConfirmation(String to, String orderNumber, String productName, String totalAmount) {
        String eventKey = "ORDER_CONFIRMATION:" + orderNumber;
        if (isAlreadySent(eventKey)) {
            log.info("Skipping duplicate order confirmation email for eventKey={}", eventKey);
            return;
        }
        String safeOrder = escapeHtml(orderNumber);
        String safeProduct = escapeHtml(productName);
        String safeAmount = escapeHtml(totalAmount);

        String subject = "Klarheit 订单已确认 / Order Confirmed — " + orderNumber;
        String htmlBody = """
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px;">
                  <div style="text-align: center; margin-bottom: 28px;">
                    <span style="font-size: 24px; font-weight: 800; letter-spacing: 0.12em; color: #0f172a; text-transform: uppercase;">KLARHEIT</span>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">定制光学眼镜 · Custom Optical Eyewear</div>
                  </div>
                  <h1 style="color: #0f172a; font-size: 20px; font-weight: 700; margin-bottom: 10px; text-align: center;">感谢您的订购 · Thank you for your order</h1>
                  <p style="color: #475569; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 24px;">
                    我们已收到您的订单并进入验配复核队列。如需补充处方或核对细节，客服将第一时间联系您。<br/>
                    Your order is confirmed and queued for optician prescription review.
                  </p>
                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <table style="width: 100%%; border-collapse: collapse;">
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 0; color: #64748b; font-size: 13px;">订单号 / Order No.</td>
                        <td style="padding: 10px 0; font-weight: 700; color: #0f172a; text-align: right;">%s</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 0; color: #64748b; font-size: 13px;">镜框款式 / Frame</td>
                        <td style="padding: 10px 0; color: #0f172a; text-align: right;">%s</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 13px;">实付金额 / Total (CNY)</td>
                        <td style="padding: 10px 0; font-weight: 700; color: #0f172a; font-size: 16px; text-align: right;">¥%s</td>
                      </tr>
                    </table>
                  </div>
                  <p style="color: #64748b; font-size: 13px; line-height: 1.6; text-align: center; margin-bottom: 20px;">
                    预计 7–10 个工作日内完成配镜、质检并发货（约 10 个工作日送达，受补充处方或偏远地区物流影响可能会顺延）。您可随时在「我的账户」查看实时进度。<br/>
                    Estimated dispatch: 7–10 business days after review (approx. 10 business days delivery). Track status anytime in My Account.
                  </p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                  <p style="color: #94a3b8; font-size: 11px; text-align: center;">Klarheit &copy; 2026</p>
                </div>
                """.formatted(safeOrder, safeProduct, safeAmount);

        sendTracked(eventKey, "ORDER_CONFIRMATION", orderNumber, to, "order-" + orderNumber, subject, htmlBody);
    }

    @Async
    @Retryable(
        retryFor = { ResourceAccessException.class, org.springframework.web.client.HttpServerErrorException.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 2000, multiplier = 2.0)
    )
    public void sendShippingNotification(String to, String orderNumber, String productName, String carrier, String trackingNumber) {
        String eventKey = "SHIPPING:" + orderNumber + ":" + (trackingNumber != null ? trackingNumber.trim() : "INIT");
        if (isAlreadySent(eventKey)) {
            log.info("Skipping duplicate shipping notification email for eventKey={}", eventKey);
            return;
        }
        String safeOrder = escapeHtml(orderNumber);
        String safeProduct = escapeHtml(productName);
        String safeCarrier = escapeHtml(carrier);
        String safeTracking = escapeHtml(trackingNumber);

        String subject = "Klarheit 订单已发货 / Order Shipped — " + orderNumber;
        String htmlBody = """
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px;">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 24px; font-weight: 800; letter-spacing: 0.12em; color: #0f172a; text-transform: uppercase;">KLARHEIT</span>
                  </div>
                  <h1 style="color: #0f172a; font-size: 20px; font-weight: 700; text-align: center;">您的定制眼镜已发货 · Your Order Has Shipped</h1>
                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0;">
                    <table style="width: 100%%; border-collapse: collapse;">
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 0; color: #64748b; font-size: 13px;">订单号 / Order No.</td>
                        <td style="padding: 10px 0; font-weight: 700; color: #0f172a; text-align: right;">%s</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 0; color: #64748b; font-size: 13px;">镜框款式 / Frame</td>
                        <td style="padding: 10px 0; color: #0f172a; text-align: right;">%s</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 0; color: #64748b; font-size: 13px;">承运商 / Carrier</td>
                        <td style="padding: 10px 0; color: #0f172a; text-align: right;">%s</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 13px;">运单号 / Tracking No.</td>
                        <td style="padding: 10px 0; font-weight: 700; color: #0f172a; text-align: right;">%s</td>
                      </tr>
                    </table>
                  </div>
                  <p style="color: #64748b; font-size: 13px; text-align: center;">收到后如有佩戴不适、破损或验配问题，请在订单详情页提交售后申请。</p>
                </div>
                """.formatted(safeOrder, safeProduct, safeCarrier, safeTracking);

        sendTracked(eventKey, "SHIPPING_NOTIFICATION", orderNumber, to, "ship-" + orderNumber, subject, htmlBody);
    }

    /**
     * P0-02: Proactive reminder before an AWAITING_REVIEW or QUOTE_READY inventory hold expires.
     */
    public void sendHoldExpiryReminder(String to, String orderNumber, String status, LocalDateTime expiresAt) {
        if (to == null || to.isBlank()) return;
        String eventKey = "HOLD_REMINDER:" + orderNumber + ":" + (status != null ? status.toUpperCase() : "HOLD");
        if (isAlreadySent(eventKey)) {
            return;
        }
        String safeOrder = escapeHtml(orderNumber);
        String deadlineText = expiresAt != null ? expiresAt.format(DISPLAY_FMT) + " (Asia/Shanghai)" : "";
        boolean isQuoteReady = "QUOTE_READY".equalsIgnoreCase(status);
        String subject = isQuoteReady
                ? "Klarheit 报价即将过期提醒 / Quote Expiring Soon — " + orderNumber
                : "Klarheit 验配复核进度提醒 / Optician Review Reminder — " + orderNumber;
        String htmlBody = """
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
                  <h2 style="color: #0f172a; font-size: 18px; margin-bottom: 12px;">%s</h2>
                  <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                    订单号 <strong>%s</strong> 的库存预占将于 <strong>%s</strong> 到期。%s
                  </p>
                </div>
                """.formatted(
                escapeHtml(subject),
                safeOrder,
                escapeHtml(deadlineText),
                isQuoteReady
                        ? "请尽快登录 Klarheit 订单详情页核对最新方案并完成付款；超时后系统将自动释放预占库存。"
                        : "验配师正在加快复核，如超过复核时限订单将自动关闭并释放库存，客服也会同步跟进。"
        );
        try {
            sendTracked(eventKey, "HOLD_EXPIRY_REMINDER", orderNumber, to, "hold-reminder-" + orderNumber, subject, htmlBody);
        } catch (Exception ex) {
            recordFailure(eventKey, "HOLD_EXPIRY_REMINDER", orderNumber, to, subject, htmlBody, ex);
            writeEmailPreview("hold-reminder-" + orderNumber, htmlBody);
        }
    }

    /**
     * Sec 6 P1: Idempotent operator resend of a failed email notification.
     * Never resends an event that has already been marked SENT.
     */
    public EmailNotificationLog resendNotification(Long logId, String operatorEmail) {
        if (notificationLogRepository == null) {
            throw new IllegalStateException("Email notification repository is unavailable.");
        }
        EmailNotificationLog entry = notificationLogRepository.findById(logId)
                .orElseThrow(() -> new IllegalArgumentException("Email notification log not found: " + logId));
        if (EmailNotificationLog.STATUS_SENT.equalsIgnoreCase(entry.getStatus())) {
            log.info("Notification log {} (eventKey={}) is already SENT; skipping duplicate resend.",
                    logId, entry.getEventKey());
            return entry;
        }
        LocalDateTime now = BusinessClock.now();
        entry.setAttemptCount(entry.getAttemptCount() + 1);
        entry.setLastAttemptedAt(now);
        entry.setResentBy(operatorEmail);
        try {
            sendOrPreview(entry.getRecipientEmail(), "resend-" + entry.getId(), entry.getSubject(), entry.getBodyHtml());
            entry.setStatus(EmailNotificationLog.STATUS_SENT);
            entry.setSentAt(now);
            entry.setLastError(null);
        } catch (Exception ex) {
            entry.setStatus(EmailNotificationLog.STATUS_FAILED);
            entry.setLastError(truncateError(ex.getMessage()));
            notificationLogRepository.save(entry);
            throw ex;
        }
        return notificationLogRepository.save(entry);
    }

    public Page<EmailNotificationLog> listNotifications(String status, Pageable pageable) {
        if (notificationLogRepository == null) {
            return Page.empty(pageable);
        }
        if (status != null && !status.isBlank()) {
            return notificationLogRepository.findByStatusOrderByCreatedAtDesc(status.trim().toUpperCase(), pageable);
        }
        return notificationLogRepository.findAllByOrderByCreatedAtDesc(pageable);
    }

    public long countFailedNotifications() {
        if (notificationLogRepository == null) return 0L;
        return notificationLogRepository.countByStatus(EmailNotificationLog.STATUS_FAILED);
    }

    private void sendTracked(
            String eventKey,
            String eventType,
            String orderNumber,
            String to,
            String filePrefix,
            String subject,
            String htmlBody) {
        sendOrPreview(to, filePrefix, subject, htmlBody);
        recordSent(eventKey, eventType, orderNumber, to, subject, htmlBody);
    }

    private boolean isAlreadySent(String eventKey) {
        if (notificationLogRepository == null || eventKey == null) return false;
        return notificationLogRepository.findByEventKey(eventKey)
                .map(existing -> EmailNotificationLog.STATUS_SENT.equalsIgnoreCase(existing.getStatus()))
                .orElse(false);
    }

    private void recordSent(String eventKey, String eventType, String orderNumber, String to, String subject, String htmlBody) {
        if (notificationLogRepository == null) return;
        try {
            LocalDateTime now = BusinessClock.now();
            EmailNotificationLog entry = notificationLogRepository.findByEventKey(eventKey)
                    .orElseGet(() -> {
                        EmailNotificationLog n = new EmailNotificationLog();
                        n.setEventKey(eventKey);
                        n.setEventType(eventType);
                        n.setOrderNumber(orderNumber);
                        n.setCreatedAt(now);
                        return n;
                    });
            entry.setRecipientEmail(to != null ? to : "");
            entry.setSubject(subject);
            entry.setBodyHtml(htmlBody);
            entry.setAttemptCount(entry.getAttemptCount() + 1);
            entry.setLastAttemptedAt(now);
            entry.setSentAt(now);
            entry.setStatus(EmailNotificationLog.STATUS_SENT);
            entry.setLastError(null);
            notificationLogRepository.save(entry);
        } catch (Exception ex) {
            log.warn("Failed to persist SENT email notification log for {}: {}", eventKey, ex.getMessage());
        }
    }

    private void recordFailure(
            String eventKey,
            String eventType,
            String orderNumber,
            String to,
            String subject,
            String htmlBody,
            Exception failure) {
        if (notificationLogRepository == null) return;
        try {
            LocalDateTime now = BusinessClock.now();
            EmailNotificationLog entry = notificationLogRepository.findByEventKey(eventKey)
                    .orElseGet(() -> {
                        EmailNotificationLog n = new EmailNotificationLog();
                        n.setEventKey(eventKey);
                        n.setEventType(eventType);
                        n.setOrderNumber(orderNumber);
                        n.setCreatedAt(now);
                        return n;
                    });
            if (EmailNotificationLog.STATUS_SENT.equalsIgnoreCase(entry.getStatus())) {
                return;
            }
            entry.setRecipientEmail(to != null ? to : "");
            entry.setSubject(subject);
            entry.setBodyHtml(htmlBody);
            entry.setAttemptCount(entry.getAttemptCount() + 1);
            entry.setLastAttemptedAt(now);
            entry.setStatus(EmailNotificationLog.STATUS_FAILED);
            entry.setLastError(truncateError(failure != null ? failure.getMessage() : "Unknown delivery failure"));
            notificationLogRepository.save(entry);
        } catch (Exception ex) {
            log.warn("Failed to persist FAILED email notification log for {}: {}", eventKey, ex.getMessage());
        }
    }

    private String truncateError(String msg) {
        if (msg == null) return null;
        return msg.length() <= 1000 ? msg : msg.substring(0, 1000);
    }

    private void sendOrPreview(String to, String filePrefix, String subject, String htmlBody) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("Resend API key not configured. Rendering local transaction HTML preview to target/emails/.");
            writeEmailPreview(filePrefix, htmlBody);
            return;
        }

        restClient.post()
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + apiKey)
                .body(Map.of(
                        "from", fromEmail,
                        "to", to,
                        "subject", subject,
                        "html", htmlBody))
                .retrieve()
                .toBodilessEntity();
        log.info("Email successfully sent to {} with subject {}", to, subject);
    }

    @Recover
    public void recoverSendOrderConfirmation(Exception e, String to, String orderNumber, String productName, String totalAmount) {
        log.error("Failed to send order confirmation email to {} for order {} after retries. Recording failure in outbox.",
                to, orderNumber, e);
        String subject = "Klarheit 订单已确认 / Order Confirmed — " + orderNumber;
        String htmlBody = """
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1>Order Confirmed — %s</h1>
                  <p>Product: %s</p>
                  <p>Total: ¥%s</p>
                </div>
                """.formatted(escapeHtml(orderNumber), escapeHtml(productName), escapeHtml(totalAmount));
        recordFailure("ORDER_CONFIRMATION:" + orderNumber, "ORDER_CONFIRMATION", orderNumber, to, subject, htmlBody, e);
        writeEmailPreview("order-" + orderNumber, htmlBody);
    }

    @Recover
    public void recoverSendShippingNotification(Exception e, String to, String orderNumber, String productName, String carrier, String trackingNumber) {
        log.error("Failed to send shipping email to {} for order {} after retries. Recording failure in outbox.",
                to, orderNumber, e);
        String subject = "Klarheit 订单已发货 / Order Shipped — " + orderNumber;
        String htmlBody = """
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1>Order Shipped — %s</h1>
                  <p>Product: %s</p>
                  <p>Carrier: %s · Tracking: %s</p>
                </div>
                """.formatted(escapeHtml(orderNumber), escapeHtml(productName), escapeHtml(carrier), escapeHtml(trackingNumber));
        String eventKey = "SHIPPING:" + orderNumber + ":" + (trackingNumber != null ? trackingNumber.trim() : "INIT");
        recordFailure(eventKey, "SHIPPING_NOTIFICATION", orderNumber, to, subject, htmlBody, e);
        writeEmailPreview("ship-" + orderNumber, htmlBody);
    }

    private void writeEmailPreview(String filePrefix, String htmlContent) {
        try {
            Files.createDirectories(Paths.get("target", "emails"));
            String safePrefix = filePrefix.replaceAll("[^a-zA-Z0-9\\-_]", "_");
            String filePath = Paths.get("target", "emails", safePrefix + ".html").toString();
            try (FileWriter writer = new FileWriter(filePath)) {
                writer.write(htmlContent);
            }
            log.info("Local transaction email preview written successfully to: {}", filePath);
        } catch (IOException e) {
            log.error("Failed to write local transaction email preview for {}: {}", filePrefix, e.getMessage());
        }
    }

    private String escapeHtml(String raw) {
        if (raw == null) return "";
        return raw.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
