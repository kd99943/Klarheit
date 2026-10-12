package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.alipay.api.AlipayClient;
import com.alipay.api.request.AlipayTradePagePayRequest;
import com.alipay.api.response.AlipayTradePagePayResponse;
import com.klarheit.backend.payment.PaymentInitiateResult;
import com.klarheit.backend.payment.PaymentServiceImpl;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {

    @InjectMocks
    private PaymentServiceImpl paymentService;

    @BeforeEach
    void setUp() {
        // Set up the default frontend and backend URLs to avoid null values
        ReflectionTestUtils.setField(paymentService, "frontendUrl", "http://localhost:5173");
        ReflectionTestUtils.setField(paymentService, "backendBaseUrl", "http://localhost:8081");
    }

    @Test
    void testInitiatePaymentWeChat() {
        String orderNumber = "ORD-20260627";
        BigDecimal amount = new BigDecimal("128.50");

        PaymentInitiateResult result = paymentService.initiatePayment(orderNumber, amount, "WECHAT");

        assertThat(result).isNotNull();
        assertThat(result.transactionId()).startsWith("TX-");
        assertThat(result.payData()).isEqualTo("weixin://wxpay/bizpayurl?pr=mock_ORD-20260627_128.50");
    }

    @Test
    void testInitiatePaymentAlipayConfiguredAndSuccessful() throws Exception {
        // Set Alipay credentials to pass the configuration checks
        ReflectionTestUtils.setField(paymentService, "alipayAppId", "app-id");
        ReflectionTestUtils.setField(paymentService, "alipayPrivateKey", "private-key");
        ReflectionTestUtils.setField(paymentService, "alipayPublicKey", "public-key");

        // Mock the AlipayClient and set it on the service
        AlipayClient mockAlipayClient = mock(AlipayClient.class);
        ReflectionTestUtils.setField(paymentService, "alipayClient", mockAlipayClient);

        // Mock the response from Alipay
        AlipayTradePagePayResponse mockResponse = mock(AlipayTradePagePayResponse.class);
        when(mockResponse.isSuccess()).thenReturn(true);
        when(mockResponse.getBody()).thenReturn("<html>alipay_form_content</html>");
        when(mockAlipayClient.pageExecute(any(AlipayTradePagePayRequest.class))).thenReturn(mockResponse);

        String orderNumber = "ORD-12345";
        BigDecimal amount = new BigDecimal("99.99");

        PaymentInitiateResult result = paymentService.initiatePayment(orderNumber, amount, "ALIPAY");

        assertThat(result).isNotNull();
        assertThat(result.transactionId()).startsWith("TX-");
        assertThat(result.payData()).isEqualTo("<html>alipay_form_content</html>");

        verify(mockAlipayClient).pageExecute(any(AlipayTradePagePayRequest.class));
    }

    @Test
    void testInitiatePaymentAlipayConfiguredButFailedFallback() throws Exception {
        ReflectionTestUtils.setField(paymentService, "alipayAppId", "app-id");
        ReflectionTestUtils.setField(paymentService, "alipayPrivateKey", "private-key");
        ReflectionTestUtils.setField(paymentService, "alipayPublicKey", "public-key");

        AlipayClient mockAlipayClient = mock(AlipayClient.class);
        ReflectionTestUtils.setField(paymentService, "alipayClient", mockAlipayClient);

        AlipayTradePagePayResponse mockResponse = mock(AlipayTradePagePayResponse.class);
        when(mockResponse.isSuccess()).thenReturn(false);
        when(mockResponse.getMsg()).thenReturn("Mocked failure response");
        when(mockAlipayClient.pageExecute(any(AlipayTradePagePayRequest.class))).thenReturn(mockResponse);

        String orderNumber = "ORD-12345";
        BigDecimal amount = new BigDecimal("99.99");

        PaymentInitiateResult result = paymentService.initiatePayment(orderNumber, amount, "ALIPAY");

        assertThat(result).isNotNull();
        assertThat(result.transactionId()).startsWith("TX-");
        assertThat(result.payData()).contains("action='/api/v1/payments/callback/mock-terminal'")
                .contains("value='ORD-12345'")
                .contains("value='99.99'");

        verify(mockAlipayClient).pageExecute(any(AlipayTradePagePayRequest.class));
    }

    @Test
    void testInitiatePaymentAlipayConfiguredButThrowsExceptionFallback() throws Exception {
        ReflectionTestUtils.setField(paymentService, "alipayAppId", "app-id");
        ReflectionTestUtils.setField(paymentService, "alipayPrivateKey", "private-key");
        ReflectionTestUtils.setField(paymentService, "alipayPublicKey", "public-key");

        AlipayClient mockAlipayClient = mock(AlipayClient.class);
        ReflectionTestUtils.setField(paymentService, "alipayClient", mockAlipayClient);

        when(mockAlipayClient.pageExecute(any(AlipayTradePagePayRequest.class)))
                .thenThrow(new RuntimeException("Simulated SDK exception"));

        String orderNumber = "ORD-12345";
        BigDecimal amount = new BigDecimal("99.99");

        PaymentInitiateResult result = paymentService.initiatePayment(orderNumber, amount, "ALIPAY");

        assertThat(result).isNotNull();
        assertThat(result.transactionId()).startsWith("TX-");
        assertThat(result.payData()).contains("action='/api/v1/payments/callback/mock-terminal'")
                .contains("value='ORD-12345'")
                .contains("value='99.99'");

        verify(mockAlipayClient).pageExecute(any(AlipayTradePagePayRequest.class));
    }

    @Test
    void testInitiatePaymentAlipayNotConfiguredFallback() {
        // Ensure credentials are empty/not configured
        ReflectionTestUtils.setField(paymentService, "alipayAppId", "");
        ReflectionTestUtils.setField(paymentService, "alipayPrivateKey", "");
        ReflectionTestUtils.setField(paymentService, "alipayPublicKey", "");

        String orderNumber = "ORD-54321";
        BigDecimal amount = new BigDecimal("50.00");

        PaymentInitiateResult result = paymentService.initiatePayment(orderNumber, amount, "ALIPAY");

        assertThat(result).isNotNull();
        assertThat(result.transactionId()).startsWith("TX-");
        assertThat(result.payData())
                .contains("<form id='alipay_submit'")
                .contains("action='/api/v1/payments/callback/mock-terminal'")
                .contains("value='ORD-54321'")
                .contains("value='50.00'")
                .contains("style='display:none;'");
    }

    @Test
    void testInitiatePaymentUnsupportedChannelThrowsException() {
        assertThatThrownBy(() -> paymentService.initiatePayment("ORD-1", new BigDecimal("10.00"), "STRIPE"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Unsupported payment channel: STRIPE");
    }
}
