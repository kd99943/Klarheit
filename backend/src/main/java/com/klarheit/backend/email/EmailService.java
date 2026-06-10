package com.klarheit.backend.email;

import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class EmailService {
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_API_URL = "https://api.resend.com/emails";

    private final RestClient restClient;
    private final String apiKey;
    private final String fromEmail;

    public EmailService(
            RestClient.Builder restClientBuilder,
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from-email:orders@klarheit.com}") String fromEmail) {
        this.restClient = restClientBuilder.baseUrl(RESEND_API_URL).build();
        this.apiKey = apiKey;
        this.fromEmail = fromEmail;
    }

    @Async
    @Retryable(
        retryFor = { Exception.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 2000, multiplier = 2.0)
    )
    public void sendOrderConfirmation(String to, String orderNumber, String productName, String totalAmount) {
        String subject = "Order Confirmed — " + orderNumber;
        String htmlBody = """
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <span style="font-size: 24px; font-weight: 800; letter-spacing: 0.1em; color: #0f172a; text-transform: uppercase;">KLARHEIT</span>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Swiss Precision Eyewear</div>
                  </div>
                  <h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin-bottom: 10px; text-align: center;">Thank you for your order!</h1>
                  <p style="color: #475569; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 30px;">Your Klarheit order has been confirmed and is being processed by our design team.</p>
                  
                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                    <table style="width: 100%%; border-collapse: collapse;">
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Order Number</td>
                        <td style="padding: 10px 0; font-weight: 700; color: #0f172a; text-align: right;">%s</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Product</td>
                        <td style="padding: 10px 0; color: #0f172a; text-align: right;">%s</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Total Amount</td>
                        <td style="padding: 10px 0; font-weight: 700; color: #0f172a; font-size: 16px; text-align: right;">$%s</td>
                      </tr>
                    </table>
                  </div>
                  
                  <p style="color: #64748b; font-size: 13px; text-align: center; margin-bottom: 25px;">Estimated delivery: 14 business days. You will receive a tracking link once shipped.</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
                  <p style="color: #94a3b8; font-size: 11px; text-align: center;">Klarheit Swiss Precision Eyewear &copy; 2026. All rights reserved.</p>
                </div>
                """.formatted(orderNumber, productName, totalAmount);

        if (apiKey == null || apiKey.isBlank()) {
            log.warn("Resend API key not configured. Rendering local transaction HTML preview to target/emails/.");
            writeEmailPreview(orderNumber, htmlBody);
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
        log.info("Order confirmation email successfully sent to {} for order {}", to, orderNumber);
    }

    private void writeEmailPreview(String orderNumber, String htmlContent) {
        try {
            Files.createDirectories(Paths.get("target", "emails"));
            String filePath = Paths.get("target", "emails", "order-" + orderNumber + ".html").toString();
            try (FileWriter writer = new FileWriter(filePath)) {
                writer.write(htmlContent);
            }
            log.info("Local transaction email preview written successfully to: {}", filePath);
        } catch (IOException e) {
            log.error("Failed to write local transaction email preview for order {}: {}", orderNumber, e.getMessage());
        }
    }
}
