package com.klarheit.backend.email;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
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
    public void sendOrderConfirmation(String to, String orderNumber, String productName, String totalAmount) {
        if (apiKey.isBlank()) {
            log.warn("Resend API key not configured. Skipping email to {} for order {}", to, orderNumber);
            return;
        }

        String subject = "Order Confirmed — " + orderNumber;
        String htmlBody = """
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #0f172a;">Thank you for your order!</h1>
                  <p>Your Klarheit order has been confirmed.</p>
                  <table style="width: 100%%; border-collapse: collapse; margin: 20px 0;">
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Order Number</td>
                      <td style="padding: 8px 0; font-weight: bold;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Product</td>
                      <td style="padding: 8px 0;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Total</td>
                      <td style="padding: 8px 0; font-weight: bold;">$%s</td>
                    </tr>
                  </table>
                  <p style="color: #64748b;">Estimated delivery: 14 business days</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                  <p style="color: #94a3b8; font-size: 12px;">Klarheit — Swiss Precision Eyewear</p>
                </div>
                """.formatted(orderNumber, productName, totalAmount);

        try {
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
            log.info("Order confirmation email sent to {} for order {}", to, orderNumber);
        } catch (Exception e) {
            log.error("Failed to send order confirmation email to {} for order {}: {}", to, orderNumber, e.getMessage());
        }
    }
}
