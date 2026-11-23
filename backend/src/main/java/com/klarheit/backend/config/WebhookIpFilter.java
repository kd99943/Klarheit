package com.klarheit.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.InetAddress;
import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Security filter that restricts access to payment webhook endpoints
 * based on a configurable IP whitelist.
 *
 * When the whitelist is empty or not configured, the filter is effectively
 * disabled (all IPs are allowed) — this keeps local development frictionless.
 *
 * In production, set PAYMENT_WEBHOOK_IP_WHITELIST to a comma-separated list
 * of Alipay and WeChat Pay server IPs.
 */
@Slf4j
@Component
public class WebhookIpFilter extends OncePerRequestFilter {

    private static final String WEBHOOK_PATH_PREFIX = "/api/v1/payments/callback/";

    @Value("${app.payment.webhook-ip-whitelist:}")
    private String webhookIpWhitelist;

    @Value("${app.payment.webhook-trust-forwarded-for:false}")
    private boolean trustForwardedFor;

    @Value("${app.payment.mock-enabled:false}")
    private boolean mockEnabled;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();

        // Apply to webhook callback paths (mock paths are only bypassed when mockEnabled=true in dev/test)
        boolean isMockPath = path.contains("mock-trigger") || path.contains("mock-terminal");
        if (path.startsWith(WEBHOOK_PATH_PREFIX) && (!isMockPath || !mockEnabled)) {

            List<String> allowedIps = parseWhitelist();
            if (!allowedIps.isEmpty()) {
                String clientIp = resolveClientIp(request);
                if (!isIpAllowed(clientIp, allowedIps)) {
                    log.warn("[WebhookIpFilter] Rejected webhook request from IP: {} to path: {}", clientIp, path);
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"code\":\"FAIL\",\"message\":\"IP not allowed\"}");
                    return;
                }
                log.debug("[WebhookIpFilter] Allowed webhook request from whitelisted IP: {}", clientIp);
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Resolves the real client IP.
     *
     * <p>Proxy headers (X-Forwarded-For / X-Real-IP) are only honored when
     * {@code app.payment.webhook-trust-forwarded-for} is enabled, which should be
     * set to true only when the app sits behind a trusted reverse proxy that
     * overwrites client-supplied X-Forwarded-For. Default false prevents an
     * attacker from spoofing the header to bypass the IP whitelist.</p>
     */
    private String resolveClientIp(HttpServletRequest request) {
        if (trustForwardedFor) {
            String xForwardedFor = request.getHeader("X-Forwarded-For");
            if (xForwardedFor != null && !xForwardedFor.isBlank()) {
                // Take the first IP in the chain (original client)
                return xForwardedFor.split(",")[0].trim();
            }
            String xRealIp = request.getHeader("X-Real-IP");
            if (xRealIp != null && !xRealIp.isBlank()) {
                return xRealIp.trim();
            }
        }
        return request.getRemoteAddr();
    }

    private List<String> parseWhitelist() {
        if (webhookIpWhitelist == null || webhookIpWhitelist.isBlank()) {
            return List.of();
        }
        return Arrays.stream(webhookIpWhitelist.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    /**
     * Checks if the client IP matches any entry in the whitelist.
     * Supports exact IP matching. CIDR notation support can be added later.
     */
    private boolean isIpAllowed(String clientIp, List<String> allowedIps) {
        for (String allowed : allowedIps) {
            if (allowed.contains("/")) {
                // CIDR matching
                if (isInCidrRange(clientIp, allowed)) {
                    return true;
                }
            } else {
                // Exact match
                if (allowed.equals(clientIp)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Basic CIDR range check. Converts both the client IP and CIDR network
     * address to byte arrays and compares the prefix bits.
     */
    private boolean isInCidrRange(String clientIp, String cidr) {
        try {
            String[] parts = cidr.split("/");
            if (parts.length != 2) return false;

            InetAddress networkAddr = InetAddress.getByName(parts[0]);
            int prefixLength = Integer.parseInt(parts[1]);

            byte[] networkBytes = networkAddr.getAddress();
            byte[] clientBytes = InetAddress.getByName(clientIp).getAddress();

            if (networkBytes.length != clientBytes.length) return false;

            int fullBytes = prefixLength / 8;
            int remainingBits = prefixLength % 8;

            for (int i = 0; i < fullBytes; i++) {
                if (networkBytes[i] != clientBytes[i]) return false;
            }

            if (remainingBits > 0 && fullBytes < networkBytes.length) {
                int mask = 0xFF << (8 - remainingBits);
                if ((networkBytes[fullBytes] & mask) != (clientBytes[fullBytes] & mask)) {
                    return false;
                }
            }

            return true;
        } catch (Exception e) {
            log.warn("[WebhookIpFilter] Failed to parse CIDR range: {}", cidr, e);
            return false;
        }
    }
}
