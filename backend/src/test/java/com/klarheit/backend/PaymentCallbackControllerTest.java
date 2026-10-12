package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.klarheit.backend.order.OrderService;
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
import org.springframework.http.ResponseEntity;
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
    void handleAlipayCallbackRejectsWhenPublicKeyNotConfigured() {
        // Security regression test: previously an unconfigured Alipay public key
        // fell back to a custom HMAC scheme. Real callbacks must now be rejected.
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
        // Build mock XML callback body
        String rawXml = "<xml>" +
                "<out_trade_no><![CDATA[KL-5678]]></out_trade_no>" +
                "<transaction_id><![CDATA[WX-TX-222]]></transaction_id>" +
                "<result_code><![CDATA[SUCCESS]]></result_code>" +
                "<sign><![CDATA[MOCK_SIGN]]></sign>" +
                "</xml>";

        // Build payload and sign it
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
        // Generate an RSA key pair for testing
        java.security.KeyPairGenerator keyGen = java.security.KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        java.security.KeyPair keyPair = keyGen.generateKeyPair();

        // Set the public key on the controller
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
        // Sign the message using the private key
        String signatureBase64 = signMessage(timestamp, callbackNonce, jsonBody, keyPair.getPrivate());

        ResponseEntity<String> response = paymentCallbackController.handleWeChatCallback(
                signatureBase64, timestamp, callbackNonce, "mock-serial", jsonBody);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).contains("SUCCESS");
        // amount.total=85000 fen = 850.00 yuan, passed for verification
        verify(orderService).completePayment(eq("KL-8888"), eq("WX-TX-444"), eq("WECHAT"), eq(java.math.BigDecimal.valueOf(85000, 2)));
    }

    @Test
    void handleWeChatCallbackV3RejectsInvalidSignature() throws Exception {
        // Generate an RSA key pair and set the public key
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
        // Set a public key to enable signature verification
        ReflectionTestUtils.setField(paymentCallbackController, "wechatPlatformPublicKey", "somePublicKey");

        String jsonBody = "{\"resource\":{\"ciphertext\":\"abc\",\"nonce\":\"123\"}}";

        ResponseEntity<String> response = paymentCallbackController.handleWeChatCallback(
                null, null, null, null, jsonBody);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).contains("Missing signature headers");
        verify(orderService, never()).completePayment(any(), any(), any());
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

