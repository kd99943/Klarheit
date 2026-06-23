package com.klarheit.backend.sms;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@ConditionalOnProperty(name = "app.sms.provider", havingValue = "mock", matchIfMissing = true)
public class MockSmsService implements SmsService {
    @Override
    public void sendVerificationCode(String phone, String code) {
        log.info("=== MOCK SMS === To: {} Code: {}", phone, code);
    }
}
