package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.klarheit.backend.config.WebhookIpFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import java.io.IOException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

class WebhookIpFilterTest {

    private WebhookIpFilter filter;
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        filter = new WebhookIpFilter();
        filterChain = mock(FilterChain.class);
    }

    @Test
    void whenWhitelistIsEmptyAllIpsArePermitted() throws ServletException, IOException {
        ReflectionTestUtils.setField(filter, "webhookIpWhitelist", "");

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/payments/callback/alipay");
        request.setRemoteAddr("192.168.1.100");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain, times(1)).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void whenWhitelistHasExactIpsMatchesAreAllowedAndMismatchesBlocked() throws ServletException, IOException {
        ReflectionTestUtils.setField(filter, "webhookIpWhitelist", "192.168.1.1,10.0.0.1");

        // Allowed IP
        MockHttpServletRequest request1 = new MockHttpServletRequest();
        request1.setRequestURI("/api/v1/payments/callback/wechat");
        request1.setRemoteAddr("192.168.1.1");
        MockHttpServletResponse response1 = new MockHttpServletResponse();

        filter.doFilter(request1, response1, filterChain);
        verify(filterChain, times(1)).doFilter(request1, response1);
        assertThat(response1.getStatus()).isEqualTo(200);

        reset(filterChain);

        // Blocked IP
        MockHttpServletRequest request2 = new MockHttpServletRequest();
        request2.setRequestURI("/api/v1/payments/callback/wechat");
        request2.setRemoteAddr("192.168.1.2");
        MockHttpServletResponse response2 = new MockHttpServletResponse();

        filter.doFilter(request2, response2, filterChain);
        verify(filterChain, never()).doFilter(any(), any());
        assertThat(response2.getStatus()).isEqualTo(403);
        assertThat(response2.getContentAsString()).contains("IP not allowed");
    }

    @Test
    void whenWhitelistHasCidrBlocksIpsInRangeAreAllowedAndOutOfRangeBlocked() throws ServletException, IOException {
        ReflectionTestUtils.setField(filter, "webhookIpWhitelist", "192.168.1.0/24, 10.0.0.0/8");

        // IP in range 192.168.1.0/24
        MockHttpServletRequest request1 = new MockHttpServletRequest();
        request1.setRequestURI("/api/v1/payments/callback/alipay");
        request1.setRemoteAddr("192.168.1.15");
        MockHttpServletResponse response1 = new MockHttpServletResponse();

        filter.doFilter(request1, response1, filterChain);
        verify(filterChain, times(1)).doFilter(request1, response1);
        assertThat(response1.getStatus()).isEqualTo(200);

        reset(filterChain);

        // IP in range 10.0.0.0/8
        MockHttpServletRequest request2 = new MockHttpServletRequest();
        request2.setRequestURI("/api/v1/payments/callback/alipay");
        request2.setRemoteAddr("10.250.0.99");
        MockHttpServletResponse response2 = new MockHttpServletResponse();

        filter.doFilter(request2, response2, filterChain);
        verify(filterChain, times(1)).doFilter(request2, response2);
        assertThat(response2.getStatus()).isEqualTo(200);

        reset(filterChain);

        // IP out of range
        MockHttpServletRequest request3 = new MockHttpServletRequest();
        request3.setRequestURI("/api/v1/payments/callback/alipay");
        request3.setRemoteAddr("192.168.2.1");
        MockHttpServletResponse response3 = new MockHttpServletResponse();

        filter.doFilter(request3, response3, filterChain);
        verify(filterChain, never()).doFilter(any(), any());
        assertThat(response3.getStatus()).isEqualTo(403);
    }

    @Test
    void testClientIpResolutionWhenTrustingForwardedFor() {
        // trustForwardedFor=true: proxy headers are honored
        ReflectionTestUtils.setField(filter, "trustForwardedFor", true);

        // 1. X-Forwarded-For present (first IP in chain wins)
        MockHttpServletRequest request1 = new MockHttpServletRequest();
        request1.addHeader("X-Forwarded-For", "203.0.113.195, 70.41.3.18, 150.172.238.178");
        request1.addHeader("X-Real-IP", "12.34.56.78");
        request1.setRemoteAddr("10.0.0.5");

        String resolvedIp1 = ReflectionTestUtils.invokeMethod(filter, "resolveClientIp", request1);
        assertThat(resolvedIp1).isEqualTo("203.0.113.195");

        // 2. X-Forwarded-For missing, X-Real-IP present
        MockHttpServletRequest request2 = new MockHttpServletRequest();
        request2.addHeader("X-Real-IP", "192.168.99.9");
        request2.setRemoteAddr("10.0.0.5");

        String resolvedIp2 = ReflectionTestUtils.invokeMethod(filter, "resolveClientIp", request2);
        assertThat(resolvedIp2).isEqualTo("192.168.99.9");

        // 3. No proxy headers: fall back to remote address
        MockHttpServletRequest request3 = new MockHttpServletRequest();
        request3.setRemoteAddr("172.16.254.1");

        String resolvedIp3 = ReflectionTestUtils.invokeMethod(filter, "resolveClientIp", request3);
        assertThat(resolvedIp3).isEqualTo("172.16.254.1");
    }

    @Test
    void testClientIpResolutionIgnoresForwardedForByDefault() {
        // trustForwardedFor defaults to false (secure default): proxy headers are ignored
        // to prevent IP spoofing when not behind a trusted reverse proxy.
        ReflectionTestUtils.setField(filter, "trustForwardedFor", false);

        // Attacker supplies X-Forwarded-For to bypass whitelist; filter must ignore it.
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "203.0.113.195, 70.41.3.18");
        request.addHeader("X-Real-IP", "12.34.56.78");
        request.setRemoteAddr("10.0.0.5");

        String resolvedIp = ReflectionTestUtils.invokeMethod(filter, "resolveClientIp", request);
        assertThat(resolvedIp).isEqualTo("10.0.0.5");
    }

    @Test
    void bypassesFilterForNonWebhookPaths() throws ServletException, IOException {
        ReflectionTestUtils.setField(filter, "webhookIpWhitelist", "192.168.1.1");

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/auth/login"); // Non-webhook path
        request.setRemoteAddr("192.168.1.2"); // Mismatched IP
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        // Filter is bypassed, so filterChain.doFilter is still called despite mismatched IP
        verify(filterChain, times(1)).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(200);
    }
}
