package com.klarheit.backend.sms;

import java.util.Random;
import org.springframework.stereotype.Service;

@Service
public class VerificationCodeService {
    private final SmsService smsService;
    private final VerificationCodeStore store;
    private final Random random = new Random();

    public VerificationCodeService(SmsService smsService, VerificationCodeStore store) {
        this.smsService = smsService;
        this.store = store;
    }

    public void sendCode(String phone) {
        if (store.isOnCooldown(phone)) {
            long remaining = store.getCooldownRemainingSeconds(phone);
            throw new IllegalStateException("请在 " + remaining + " 秒后重试");
        }

        String code = String.format("%06d", random.nextInt(1000000));
        store.put(phone, code);
        smsService.sendVerificationCode(phone, code);
    }

    public boolean verifyCode(String phone, String code) {
        VerificationCodeStore.CodeEntry entry = store.get(phone);

        if (entry == null) {
            throw new IllegalStateException("验证码已过期或不存在");
        }

        if (store.isExpired(entry)) {
            store.remove(phone);
            throw new IllegalStateException("验证码已过期");
        }

        if (store.isMaxAttemptsReached(entry)) {
            store.remove(phone);
            throw new IllegalStateException("验证码尝试次数过多，请重新获取");
        }

        store.incrementAttempts(phone);

        if (!entry.code().equals(code)) {
            return false;
        }

        store.remove(phone);
        return true;
    }
}
