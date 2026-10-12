package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.klarheit.backend.config.RateLimitFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import java.io.IOException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

class RateLimitFilterTest {

    private RateLimitFilter filter;
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter(true, 10, 10, false);
        filterChain = mock(FilterChain.class);
    }

    @Test
    void normalRequestsWithinLimitSucceed() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/auth/login");
        request.setRemoteAddr("192.168.1.50");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain, times(1)).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void requestsExceedingLimitAreBlocked() throws ServletException, IOException {
        String clientIp = "192.168.1.100";
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/auth/login");
        request.setRemoteAddr(clientIp);

        // Consume all 10 tokens
        for (int i = 0; i < 10; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, filterChain);
            verify(filterChain, times(1)).doFilter(request, response);
            assertThat(response.getStatus()).isEqualTo(200);
            reset(filterChain);
        }

        // 11th request should be rate-limited (HTTP 429)
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, filterChain);

        verify(filterChain, never()).doFilter(any(), any());
        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getContentType()).isEqualTo("application/json");
        assertThat(response.getContentAsString()).contains("Rate limit exceeded");
    }

    @Test
    void excludedPathsBypassRateLimiting() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/products");
        request.setRemoteAddr("192.168.1.120");

        // Make 15 requests - far exceeding capacity of 10
        for (int i = 0; i < 15; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, filterChain);
            verify(filterChain, times(1)).doFilter(request, response);
            assertThat(response.getStatus()).isEqualTo(200);
            reset(filterChain);
        }
    }

    @Test
    void shouldNotFilterReturnsTrueForExcludedPaths() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/products");

        Boolean shouldNotFilter = ReflectionTestUtils.invokeMethod(filter, "shouldNotFilter", request);

        assertThat(shouldNotFilter).isTrue();
    }

    @Test
    void shouldNotFilterReturnsFalseForRateLimitedPaths() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/auth/login");

        Boolean shouldNotFilter = ReflectionTestUtils.invokeMethod(filter, "shouldNotFilter", request);

        assertThat(shouldNotFilter).isFalse();
    }

    @Test
    void shouldNotFilterReturnsFalseForRateLimitedPrefixes() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/payments/callback/alipay");

        Boolean shouldNotFilter = ReflectionTestUtils.invokeMethod(filter, "shouldNotFilter", request);

        assertThat(shouldNotFilter).isFalse();
    }
}
