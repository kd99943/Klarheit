package com.klarheit.backend.sms;

public interface SmsService {
    void sendVerificationCode(String phone, String code);
}
