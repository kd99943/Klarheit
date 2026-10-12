package com.klarheit.backend.sms;

import com.aliyun.dysmsapi20170525.Client;
import com.aliyun.dysmsapi20170525.models.SendSmsRequest;
import com.aliyun.dysmsapi20170525.models.SendSmsResponse;
import com.aliyun.teaopenapi.models.Config;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@ConditionalOnProperty(name = "app.sms.provider", havingValue = "aliyun")
public class AliyunSmsService implements SmsService {

    private final String accessKeyId;
    private final String accessKeySecret;
    private final String signName;
    private final String templateCode;
    private Client client;

    public AliyunSmsService(
            @Value("${app.sms.alibaba.access-key-id:}") String accessKeyId,
            @Value("${app.sms.alibaba.access-key-secret:}") String accessKeySecret,
            @Value("${app.sms.alibaba.sign-name:Klarheit}") String signName,
            @Value("${app.sms.alibaba.template-code:}") String templateCode) {
        this.accessKeyId = accessKeyId;
        this.accessKeySecret = accessKeySecret;
        this.signName = signName;
        this.templateCode = templateCode;

        if (accessKeyId != null && !accessKeyId.isBlank() && accessKeySecret != null && !accessKeySecret.isBlank()) {
            try {
                Config config = new Config()
                        .setAccessKeyId(accessKeyId.trim())
                        .setAccessKeySecret(accessKeySecret.trim())
                        .setEndpoint("dysmsapi.aliyuncs.com");
                this.client = new Client(config);
                log.info("[SMS] Aliyun SMS Client initialized successfully.");
            } catch (Exception e) {
                log.error("[SMS] Failed to initialize Aliyun SMS Client", e);
            }
        } else {
            log.warn("[SMS] Aliyun SMS credentials not fully configured.");
        }
    }

    @Override
    public void sendVerificationCode(String phone, String code) {
        if (client == null) {
            log.error("[SMS] Aliyun SMS Client not initialized. Cannot send code to {}", phone);
            return;
        }

        try {
            SendSmsRequest sendSmsRequest = new SendSmsRequest()
                    .setPhoneNumbers(phone)
                    .setSignName(signName)
                    .setTemplateCode(templateCode)
                    .setTemplateParam("{\"code\":\"" + code + "\"}");
            SendSmsResponse response = client.sendSms(sendSmsRequest);
            if (response.getBody() != null && "OK".equalsIgnoreCase(response.getBody().getCode())) {
                log.info("[SMS] Successfully sent verification code to {} via Aliyun.", phone);
            } else {
                String errMsg = response.getBody() != null ? response.getBody().getMessage() : "Unknown error";
                log.error("[SMS] Failed to send verification code to {}: {}", phone, errMsg);
            }
        } catch (Exception e) {
            log.error("[SMS] Exception sending verification code to {}", phone, e);
        }
    }
}
