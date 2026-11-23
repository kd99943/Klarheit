package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.alipay.api.AlipayClient;
import com.alipay.api.request.AlipayTradeCloseRequest;
import com.alipay.api.request.AlipayTradePagePayRequest;
import com.alipay.api.request.AlipayTradeQueryRequest;
import com.alipay.api.request.AlipayTradeRefundRequest;
import com.alipay.api.response.AlipayTradeCloseResponse;
import com.alipay.api.response.AlipayTradePagePayResponse;
import com.alipay.api.response.AlipayTradeQueryResponse;
import com.alipay.api.response.AlipayTradeRefundResponse;
import com.klarheit.backend.payment.PaymentInitiateResult;
import com.klarheit.backend.payment.PaymentQueryResult;
import com.klarheit.backend.payment.PaymentQueryStatus;
import com.klarheit.backend.payment.PaymentServiceImpl;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {

    @InjectMocks
    private PaymentServiceImpl paymentService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(paymentService, "frontendUrl", "http://localhost:3000");
        ReflectionTestUtils.setField(paymentService, "backendBaseUrl", "http://localhost:8081");
        ReflectionTestUtils.setField(paymentService, "mockEnabled", false);
    }

    @Test
    void testLocalPaymentReturnUrlUsesViteDevelopmentPort() {
        assertThat(paymentService.resolveReturnUrl()).isEqualTo("http://localhost:3000/my-orders");
    }

    @Test
    void testInitiatePaymentWeChatRejectedWhenMockDisabled() {
        assertThatThrownBy(() -> paymentService.initiatePayment("ORD-20260627", new BigDecimal("128.50"), "WECHAT"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("WeChat Pay is not enabled in production");
    }

    @Test
    void testInitiatePaymentWeChatAllowedWhenMockEnabled() {
        ReflectionTestUtils.setField(paymentService, "mockEnabled", true);
        String orderNumber = "ORD-20260627";
        BigDecimal amount = new BigDecimal("128.50");

        PaymentInitiateResult result = paymentService.initiatePayment(orderNumber, amount, "WECHAT");

        assertThat(result).isNotNull();
        assertThat(result.transactionId()).startsWith("TX-");
        assertThat(result.payData()).isEqualTo("weixin://wxpay/bizpayurl?pr=mock_ORD-20260627_128.50");
    }

    @Test
    void testInitiatePaymentAlipayConfiguredAndSuccessful() throws Exception {
        ReflectionTestUtils.setField(paymentService, "alipayAppId", "app-id");
        ReflectionTestUtils.setField(paymentService, "alipayPrivateKey", "private-key");
        ReflectionTestUtils.setField(paymentService, "alipayPublicKey", "public-key");

        AlipayClient mockAlipayClient = mock(AlipayClient.class);
        ReflectionTestUtils.setField(paymentService, "alipayClient", mockAlipayClient);

        AlipayTradePagePayResponse mockResponse = mock(AlipayTradePagePayResponse.class);
        when(mockResponse.isSuccess()).thenReturn(true);
        when(mockResponse.getBody()).thenReturn("<form name=\"punchout_form\" method=\"post\" action=\"https://openapi.alipay.com/gateway.do\"></form>");
        when(mockAlipayClient.pageExecute(any(AlipayTradePagePayRequest.class))).thenReturn(mockResponse);

        PaymentInitiateResult result = paymentService.initiatePayment("ORD-12345", new BigDecimal("99.99"), "ALIPAY");

        assertThat(result).isNotNull();
        assertThat(result.transactionId()).startsWith("TX-");
        assertThat(result.payData()).contains("name=\"punchout_form\"");
        verify(mockAlipayClient).pageExecute(any(AlipayTradePagePayRequest.class));
    }

    @Test
    void testInitiatePaymentAlipayConfiguredButFailedThrowsNeverFallsBackToMock() throws Exception {
        ReflectionTestUtils.setField(paymentService, "mockEnabled", true);
        ReflectionTestUtils.setField(paymentService, "alipayAppId", "app-id");
        ReflectionTestUtils.setField(paymentService, "alipayPrivateKey", "private-key");
        ReflectionTestUtils.setField(paymentService, "alipayPublicKey", "public-key");

        AlipayClient mockAlipayClient = mock(AlipayClient.class);
        ReflectionTestUtils.setField(paymentService, "alipayClient", mockAlipayClient);

        AlipayTradePagePayResponse mockResponse = mock(AlipayTradePagePayResponse.class);
        when(mockResponse.isSuccess()).thenReturn(false);
        when(mockResponse.getMsg()).thenReturn("Mocked failure response");
        when(mockAlipayClient.pageExecute(any(AlipayTradePagePayRequest.class))).thenReturn(mockResponse);

        assertThatThrownBy(() -> paymentService.initiatePayment("ORD-12345", new BigDecimal("99.99"), "ALIPAY"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Failed to initiate Alipay payment");

        verify(mockAlipayClient).pageExecute(any(AlipayTradePagePayRequest.class));
    }

    @Test
    void testInitiatePaymentAlipayConfiguredButThrowsExceptionNeverFallsBackToMock() throws Exception {
        ReflectionTestUtils.setField(paymentService, "mockEnabled", true);
        ReflectionTestUtils.setField(paymentService, "alipayAppId", "app-id");
        ReflectionTestUtils.setField(paymentService, "alipayPrivateKey", "private-key");
        ReflectionTestUtils.setField(paymentService, "alipayPublicKey", "public-key");

        AlipayClient mockAlipayClient = mock(AlipayClient.class);
        ReflectionTestUtils.setField(paymentService, "alipayClient", mockAlipayClient);

        when(mockAlipayClient.pageExecute(any(AlipayTradePagePayRequest.class)))
                .thenThrow(new RuntimeException("Simulated SDK exception"));

        assertThatThrownBy(() -> paymentService.initiatePayment("ORD-12345", new BigDecimal("99.99"), "ALIPAY"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Failed to initiate Alipay payment");

        verify(mockAlipayClient).pageExecute(any(AlipayTradePagePayRequest.class));
    }

    @Test
    void testInitiatePaymentAlipayNotConfiguredThrowsWhenMockDisabled() {
        ReflectionTestUtils.setField(paymentService, "alipayAppId", "");
        ReflectionTestUtils.setField(paymentService, "alipayPrivateKey", "");
        ReflectionTestUtils.setField(paymentService, "alipayPublicKey", "");

        assertThatThrownBy(() -> paymentService.initiatePayment("ORD-54321", new BigDecimal("50.00"), "ALIPAY"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Alipay payment gateway is not configured");
    }

    @Test
    void testInitiatePaymentAlipayNotConfiguredFallbackWhenMockEnabled() {
        ReflectionTestUtils.setField(paymentService, "mockEnabled", true);
        ReflectionTestUtils.setField(paymentService, "alipayAppId", "");
        ReflectionTestUtils.setField(paymentService, "alipayPrivateKey", "");
        ReflectionTestUtils.setField(paymentService, "alipayPublicKey", "");

        PaymentInitiateResult result = paymentService.initiatePayment("ORD-54321", new BigDecimal("50.00"), "ALIPAY");

        assertThat(result).isNotNull();
        assertThat(result.transactionId()).startsWith("TX-");
        assertThat(result.payData())
                .contains("<form id='alipay_submit'")
                .contains("action='/api/v1/payments/callback/mock-terminal'")
                .contains("value='ORD-54321'")
                .contains("value='50.00'");
    }

    @Test
    void testQueryCloseAndRefundAlipayConfigured() throws Exception {
        ReflectionTestUtils.setField(paymentService, "alipayAppId", "app-id");
        ReflectionTestUtils.setField(paymentService, "alipayPrivateKey", "private-key");
        ReflectionTestUtils.setField(paymentService, "alipayPublicKey", "public-key");

        AlipayClient mockAlipayClient = mock(AlipayClient.class);
        ReflectionTestUtils.setField(paymentService, "alipayClient", mockAlipayClient);

        AlipayTradeQueryResponse queryResp = mock(AlipayTradeQueryResponse.class);
        when(queryResp.isSuccess()).thenReturn(true);
        when(queryResp.getTradeStatus()).thenReturn("TRADE_SUCCESS");
        when(queryResp.getTradeNo()).thenReturn("ALI-TX-999");
        when(queryResp.getTotalAmount()).thenReturn("100.00");
        when(mockAlipayClient.execute(any(AlipayTradeQueryRequest.class))).thenReturn(queryResp);

        PaymentQueryResult queryResult = paymentService.queryPayment("ORD-1", "ALIPAY");
        assertThat(queryResult.status()).isEqualTo(PaymentQueryStatus.PAID);
        assertThat(queryResult.gatewayTransactionId()).isEqualTo("ALI-TX-999");
        assertThat(queryResult.paidAmount()).isEqualByComparingTo("100.00");

        AlipayTradeCloseResponse closeResp = mock(AlipayTradeCloseResponse.class);
        when(closeResp.isSuccess()).thenReturn(true);
        when(mockAlipayClient.execute(any(AlipayTradeCloseRequest.class))).thenReturn(closeResp);
        assertThat(paymentService.closePayment("ORD-1", "ALIPAY")).isTrue();

        AlipayTradeRefundResponse refundResp = mock(AlipayTradeRefundResponse.class);
        when(refundResp.isSuccess()).thenReturn(true);
        when(refundResp.getFundChange()).thenReturn("Y");
        when(mockAlipayClient.execute(any(AlipayTradeRefundRequest.class))).thenReturn(refundResp);
        assertThat(paymentService.refundPayment("ORD-1", "ALI-TX-999", new BigDecimal("100.00"), "ALIPAY", "Late callback")).isTrue();
    }

    @Test
    void testPaidQueryWithoutValidAmountRemainsUnknown() throws Exception {
        ReflectionTestUtils.setField(paymentService, "alipayAppId", "app-id");
        ReflectionTestUtils.setField(paymentService, "alipayPrivateKey", "private-key");
        ReflectionTestUtils.setField(paymentService, "alipayPublicKey", "public-key");
        AlipayClient client = mock(AlipayClient.class);
        ReflectionTestUtils.setField(paymentService, "alipayClient", client);
        AlipayTradeQueryResponse response = mock(AlipayTradeQueryResponse.class);
        when(response.isSuccess()).thenReturn(true);
        when(response.getTradeStatus()).thenReturn("TRADE_SUCCESS");
        when(client.execute(any(AlipayTradeQueryRequest.class))).thenReturn(response);

        assertThat(paymentService.queryPayment("ORD-1", "ALIPAY").status())
                .isEqualTo(PaymentQueryStatus.UNKNOWN);
    }

    @Test
    void testInitiatePaymentUnsupportedChannelThrowsException() {
        assertThatThrownBy(() -> paymentService.initiatePayment("ORD-1", new BigDecimal("10.00"), "STRIPE"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Unsupported payment channel: STRIPE");
    }

    @Test
    void testGatewayNotifyAndReturnUrlResolutionAndNormalization() throws Exception {
        ReflectionTestUtils.setField(paymentService, "alipayGatewayUrl", "openapi.alipay.com");
        ReflectionTestUtils.setField(paymentService, "backendBaseUrl", "https://api.klarheit.com/");
        ReflectionTestUtils.setField(paymentService, "frontendUrl", "https://klarheit.com/");
        ReflectionTestUtils.setField(paymentService, "alipayNotifyUrl", "");
        ReflectionTestUtils.setField(paymentService, "alipayReturnUrl", "");

        assertThat(paymentService.resolveGatewayUrl()).isEqualTo("https://openapi.alipay.com/gateway.do");
        assertThat(paymentService.resolveNotifyUrl()).isEqualTo("https://api.klarheit.com/api/v1/payments/callback/alipay");
        assertThat(paymentService.resolveReturnUrl()).isEqualTo("https://klarheit.com/my-orders");

        // Explicit ALIPAY_NOTIFY_URL and ALIPAY_RETURN_URL overrides take precedence
        ReflectionTestUtils.setField(paymentService, "alipayNotifyUrl", "https://pay.klarheit.com/webhooks/alipay");
        ReflectionTestUtils.setField(paymentService, "alipayReturnUrl", "https://klarheit.com/order-confirmation");
        assertThat(paymentService.resolveNotifyUrl()).isEqualTo("https://pay.klarheit.com/webhooks/alipay");
        assertThat(paymentService.resolveReturnUrl()).isEqualTo("https://klarheit.com/order-confirmation");

        ReflectionTestUtils.setField(paymentService, "alipayAppId", "app-id");
        ReflectionTestUtils.setField(paymentService, "alipayPrivateKey", "private-key");
        ReflectionTestUtils.setField(paymentService, "alipayPublicKey", "public-key");
        AlipayClient mockAlipayClient = mock(AlipayClient.class);
        ReflectionTestUtils.setField(paymentService, "alipayClient", mockAlipayClient);

        AlipayTradePagePayResponse mockResponse = mock(AlipayTradePagePayResponse.class);
        when(mockResponse.isSuccess()).thenReturn(true);
        when(mockResponse.getBody()).thenReturn("<form name=\"punchout_form\"></form>");
        when(mockAlipayClient.pageExecute(any(AlipayTradePagePayRequest.class))).thenReturn(mockResponse);

        paymentService.initiatePayment("ORD-URL-TEST", new BigDecimal("299.00"), "ALIPAY");

        org.mockito.ArgumentCaptor<AlipayTradePagePayRequest> reqCaptor =
                org.mockito.ArgumentCaptor.forClass(AlipayTradePagePayRequest.class);
        verify(mockAlipayClient).pageExecute(reqCaptor.capture());
        assertThat(reqCaptor.getValue().getNotifyUrl()).isEqualTo("https://pay.klarheit.com/webhooks/alipay");
        assertThat(reqCaptor.getValue().getReturnUrl()).isEqualTo("https://klarheit.com/order-confirmation");
        assertThat(reqCaptor.getValue().getBizContent()).contains("\"currency\":\"CNY\"");
    }
}
