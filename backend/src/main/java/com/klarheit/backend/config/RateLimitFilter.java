package com.klarheit.backend.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rate limiter for authentication endpoints (login/register).
 *
 * <p>Uses an in-memory bucket-per-IP model via Bucket4j. This is
 * sufficient for a single-instance deployment. For horizontal scaling,
 * replace with a Redis-backed rate limiter (e.g. Spring Cloud Gateway
 * or bucket4j-redis).</p>
 *
 * <p>IP resolution uses {@code request.getRemoteAddr()} to prevent
 * X-Forwarded-For spoofing. When behind a reverse proxy, configure
 * the proxy to set {@code X-Forwarded-For} and add a
 * {@code ForwardedHeaderFilter} or trusted-proxy configuration.</p>
 */
@Slf4j
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_ENTRIES = 4096;
    private final boolean enabled;
    private final int capacity;
    private final int refillPerMinute;
    private final Map<String, Bucket> buckets = java.util.Collections.synchronizedMap(
            new java.util.LinkedHashMap<>(MAX_ENTRIES + 1, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Bucket> eldest) {
                    return size() > MAX_ENTRIES;
                }
            }
    );

    public RateLimitFilter(
            @Value("${app.rate-limit.enabled:true}") boolean enabled,
            @Value("${app.rate-limit.capacity:10}") int capacity,
            @Value("${app.rate-limit.refill-per-minute:10}") int refillPerMinute) {
        this.enabled = enabled;
        this.capacity = capacity;
        this.refillPerMinute = refillPerMinute;
    }

    private static final java.util.Set<String> RATE_LIMITED_PATHS = java.util.Set.of(
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/orders/checkout",
            "/api/v1/coupons/validate"
    );

    private static final java.util.Set<String> RATE_LIMITED_PREFIXES = java.util.Set.of(
            "/api/v1/payments/callback/"
    );

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!enabled) return true;
        String path = request.getRequestURI();
        if (RATE_LIMITED_PATHS.contains(path)) return false;
        for (String prefix : RATE_LIMITED_PREFIXES) {
            if (path.startsWith(prefix)) return false;
        }
        return true;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String clientIp = getClientIp(request);
        Bucket bucket = buckets.computeIfAbsent(clientIp, this::createBucket);

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            log.warn("Rate limit exceeded for IP: {} on path: {}", clientIp, request.getRequestURI());
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("""
                    {"error":"Too Many Requests","message":"Rate limit exceeded. Try again later.","details":[]}
                    """);
        }
    }

    private Bucket createBucket(String key) {
        Bandwidth limit = Bandwidth.builder()
                .capacity(capacity)
                .refillGreedy(refillPerMinute, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    private String getClientIp(HttpServletRequest request) {
        // Only trust X-Forwarded-For when behind a known proxy; for now use remote addr
        // to prevent IP spoofing. In production, configure TrustedProxyFilter.
        return request.getRemoteAddr();
    }
}
