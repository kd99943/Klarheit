package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.klarheit.backend.order.OrderService;
import com.klarheit.backend.payment.MockPaymentController;
import com.klarheit.backend.payment.PaymentCallbackController;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class PaymentCallbackControllerTest {

    @Mock
    private OrderService orderService;

    @InjectMocks
    private PaymentCallbackController paymentCallbackController;

    private static final String MOCK_SECRET = "mockSecretKey1234567890123456789";
    private static final String WECHAT_KEY = "wechatApiKey32BytesLongExactly!!";

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(paymentCallbackController, "callbackSecret", MOCK_SECRET);
        ReflectionTestUtils.setField(paymentCallbackController, "wechatApiKey", WECHAT_KEY);
    }

    @Test
    void mockPaymentControllerIsAnnotatedWithDevTestProfileOnlyAndRejectsProdProfile() {
        org.springframework.context.annotation.Profile profileAnnotation =
                MockPaymentController.class.getAnnotation(org.springframework.context.annotation.Profile.class);
        assertThat(profileAnnotation).isNotNull();
        assertThat(profileAnnotation.value()).containsExactly("local & !prod", "test & !prod");

        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");
        assertThat(prodEnv.acceptsProfiles(org.springframework.core.env.Profiles.of(profileAnnotation.value()))).isFalse();

        MockEnvironment localEnv = new MockEnvironment();
        localEnv.setActiveProfiles("local");
        assertThat(localEnv.acceptsProfiles(org.springframework.core.env.Profiles.of(profileAnnotation.value()))).isTrue();
    }

    @Test
    void paymentCallbackControllerDoesNotExposeMockEndpoints() {
        long mockMethods = java.util.Arrays.stream(PaymentCallbackController.class.getDeclaredMethods())
                .filter(m -> m.getName().toLowerCase().contains("mock"))
                .count();
        assertThat(mockMethods).isZero();
    }

    @Test
    void handleAlipayCallbackRejectsWhenPublicKeyNotConfigured() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        Map<String, String[]> requestParams = new HashMap<>();
        requestParams.put("out_trade_no", new String[]{"KL-1234"});
        requestParams.put("trade_status", new String[]{"TRADE_SUCCESS"});
        requestParams.put("trade_no", new String[]{"ALIPAY-TX-111"});
        requestParams.put("sign", new String[]{"any-signature"});

        when(request.getParameterMap()).thenReturn(requestParams);

        ResponseEntity<String> response = paymentCallbackController.handleAlipayCallback(request);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).isEqualTo("failure");
        verify(orderService, never()).completePayment(any(), any(), any());
        verify(orderService, never()).completePayment(any(), any(), any(), any());
    }

    @Test
    void handleWeChatCallbackXmlHMACSuccess() {
        String rawXml = "<xml>" +
                "<out_trade_no><![CDATA[KL-5678]]></out_trade_no>" +
                "<transaction_id><![CDATA[WX-TX-222]]></transaction_id>" +
                "<result_code><![CDATA[SUCCESS]]></result_code>" +
                "<sign><![CDATA[MOCK_SIGN]]></sign>" +
                "</xml>";

        String payload = "out_trade_no=KL-5678&result_code=SUCCESS&transaction_id=WX-TX-222";
        String computedSign = ReflectionTestUtils.invokeMethod(paymentCallbackController, "hmacSha256", payload, WECHAT_KEY);
        String xmlWithRealSign = rawXml.replace("MOCK_SIGN", computedSign);

        ResponseEntity<String> response = paymentCallbackController.handleWeChatCallback(null, null, null, null, xmlWithRealSign);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).contains("SUCCESS");
        verify(orderService).completePayment("KL-5678", "WX-TX-222", "WECHAT");
    }

    @Test
    void handleWeChatCallbackV3WithSignatureVerification() throws Exception {
        java.security.KeyPairGenerator keyGen = java.security.KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        java.security.KeyPair keyPair = keyGen.generateKeyPair();

        String publicKeyBase64 = java.util.Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
        ReflectionTestUtils.setField(paymentCallbackController, "wechatPlatformPublicKey", publicKeyBase64);

        String decryptedJson = "{\"out_trade_no\":\"KL-8888\",\"transaction_id\":\"WX-TX-444\",\"trade_state\":\"SUCCESS\",\"amount\":{\"total\":85000}}";
        String nonce = "123456789012";
        String associatedData = "transaction";
        String ciphertext = encryptAesGcm(decryptedJson, associatedData, nonce, WECHAT_KEY);

        String jsonBody = "{" +
                "\"id\":\"EV-333444\"," +
                "\"resource\":{" +
                "\"algorithm\":\"AEAD_AES_256_GCM\"," +
                "\"ciphertext\":\"" + ciphertext + "\"," +
                "\"nonce\":\"" + nonce + "\"," +
                "\"associated_data\":\"" + associatedData + "\"" +
                "}}";

        String timestamp = "1719200000";
        String callbackNonce = "test-nonce";
        String signatureBase64 = signMessage(timestamp, callbackNonce, jsonBody, keyPair.getPrivate());

        ResponseEntity<String> response = paymentCallbackController.handleWeChatCallback(
                signatureBase64, timestamp, callbackNonce, "mock-serial", jsonBody);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).contains("SUCCESS");
        verify(orderService).completePayment(eq("KL-8888"), eq("WX-TX-444"), eq("WECHAT"), eq(java.math.BigDecimal.valueOf(85000, 2)));
    }

    @Test
    void handleWeChatCallbackV3RejectsInvalidSignature() throws Exception {
        java.security.KeyPairGenerator keyGen = java.security.KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        java.security.KeyPair keyPair = keyGen.generateKeyPair();

        String publicKeyBase64 = java.util.Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
        ReflectionTestUtils.setField(paymentCallbackController, "wechatPlatformPublicKey", publicKeyBase64);

        String jsonBody = "{\"resource\":{\"ciphertext\":\"abc\",\"nonce\":\"123\",\"associated_data\":\"tx\"}}";

        ResponseEntity<String> response = paymentCallbackController.handleWeChatCallback(
                "invalid-signature", "1719200000", "test-nonce", "mock-serial", jsonBody);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).contains("FAIL");
        verify(orderService, never()).completePayment(any(), any(), any());
    }

    @Test
    void handleWeChatCallbackV3RejectsMissingHeaders() throws Exception {
        ReflectionTestUtils.setField(paymentCallbackController, "wechatPlatformPublicKey", "somePublicKey");

        String jsonBody = "{\"resource\":{\"ciphertext\":\"abc\",\"nonce\":\"123\"}}";

        ResponseEntity<String> response = paymentCallbackController.handleWeChatCallback(
                null, null, null, null, jsonBody);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).contains("Missing signature headers");
        verify(orderService, never()).completePayment(any(), any(), any());
    }

    @Test
    void parseRequiredAmountRejectsMissingAndMalformedAmounts() {
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(paymentCallbackController, "parseRequiredAmount", (Object) null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(paymentCallbackController, "parseRequiredAmount", "not-a-number"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(paymentCallbackController, "parseRequiredAmount", "0.00"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void handleAlipayCallbackRejectsMissingAmountAfterSignatureVerification() {
        ReflectionTestUtils.setField(paymentCallbackController, "alipayPublicKey", "configured-public-key");
        HttpServletRequest request = mock(HttpServletRequest.class);
        Map<String, String[]> requestParams = new HashMap<>();
        requestParams.put("out_trade_no", new String[]{"KL-1234"});
        requestParams.put("trade_status", new String[]{"TRADE_SUCCESS"});
        requestParams.put("trade_no", new String[]{"ALIPAY-TX-111"});
        when(request.getParameterMap()).thenReturn(requestParams);

        try (var signatures = mockStatic(com.alipay.api.internal.util.AlipaySignature.class)) {
            signatures.when(() -> com.alipay.api.internal.util.AlipaySignature.rsaCheckV1(anyMap(), anyString(), anyString(), anyString()))
                    .thenReturn(true);
            ResponseEntity<String> response = paymentCallbackController.handleAlipayCallback(request);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
        verify(orderService, never()).completePayment(any(), any(), any());
        verify(orderService, never()).completePayment(any(), any(), any(), any());
    }

    @Test
    void handleAlipayCallbackRejectsAppIdMismatchAndAcceptsTradeFinished() {
        ReflectionTestUtils.setField(paymentCallbackController, "alipayPublicKey", "configured-public-key");
        ReflectionTestUtils.setField(paymentCallbackController, "alipayAppId", "expected-app-id");

        HttpServletRequest mismatchReq = mock(HttpServletRequest.class);
        Map<String, String[]> mismatchParams = new HashMap<>();
        mismatchParams.put("out_trade_no", new String[]{"KL-APPID-1"});
        mismatchParams.put("trade_status", new String[]{"TRADE_SUCCESS"});
        mismatchParams.put("trade_no", new String[]{"ALIPAY-TX-1"});
        mismatchParams.put("total_amount", new String[]{"850.00"});
        mismatchParams.put("app_id", new String[]{"wrong-app-id"});
        when(mismatchReq.getParameterMap()).thenReturn(mismatchParams);

        HttpServletRequest finishedReq = mock(HttpServletRequest.class);
        Map<String, String[]> finishedParams = new HashMap<>();
        finishedParams.put("out_trade_no", new String[]{"KL-APPID-2"});
        finishedParams.put("trade_status", new String[]{"TRADE_FINISHED"});
        finishedParams.put("trade_no", new String[]{"ALIPAY-TX-2"});
        finishedParams.put("total_amount", new String[]{"850.00"});
        finishedParams.put("app_id", new String[]{"expected-app-id"});
        when(finishedReq.getParameterMap()).thenReturn(finishedParams);

        try (var signatures = mockStatic(com.alipay.api.internal.util.AlipaySignature.class)) {
            signatures.when(() -> com.alipay.api.internal.util.AlipaySignature.rsaCheckV1(anyMap(), anyString(), anyString(), anyString()))
                    .thenReturn(true);

            ResponseEntity<String> mismatchResp = paymentCallbackController.handleAlipayCallback(mismatchReq);
            assertThat(mismatchResp.getStatusCode().value()).isEqualTo(400);
            verify(orderService, never()).completePayment(eq("KL-APPID-1"), any(), any(), any());

            ResponseEntity<String> finishedResp = paymentCallbackController.handleAlipayCallback(finishedReq);
            assertThat(finishedResp.getStatusCode().value()).isEqualTo(200);
            verify(orderService).completePayment("KL-APPID-2", "ALIPAY-TX-2", "ALIPAY", new java.math.BigDecimal("850.00"));
        }
    }

    private String encryptAesGcm(String plaintext, String associatedData, String nonce, String key) throws Exception {
        javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
        javax.crypto.spec.SecretKeySpec keySpec = new javax.crypto.spec.SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "AES");
        javax.crypto.spec.GCMParameterSpec gcmSpec = new javax.crypto.spec.GCMParameterSpec(128, nonce.getBytes(StandardCharsets.UTF_8));
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, keySpec, gcmSpec);
        if (associatedData != null && !associatedData.isEmpty()) {
            cipher.updateAAD(associatedData.getBytes(StandardCharsets.UTF_8));
        }
        byte[] cipherBytes = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        return java.util.Base64.getEncoder().encodeToString(cipherBytes);
    }

    private String signMessage(String timestamp, String nonce, String body, java.security.PrivateKey privateKey) throws Exception {
        String message = timestamp + "\n" + nonce + "\n" + body + "\n";
        java.security.Signature sig = java.security.Signature.getInstance("SHA256withRSA");
        sig.initSign(privateKey);
        sig.update(message.getBytes(StandardCharsets.UTF_8));
        return java.util.Base64.getEncoder().encodeToString(sig.sign());
    }
}
