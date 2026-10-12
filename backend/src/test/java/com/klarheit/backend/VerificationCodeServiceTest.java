package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.klarheit.backend.sms.SmsService;
import com.klarheit.backend.sms.VerificationCodeService;
import com.klarheit.backend.sms.VerificationCodeStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class VerificationCodeServiceTest {

    @Mock
    private SmsService smsService;

    private VerificationCodeStore store;
    private VerificationCodeService verificationCodeService;

    @BeforeEach
    void setUp() {
        store = spy(new VerificationCodeStore());
        verificationCodeService = new VerificationCodeService(smsService, store);
    }

    @Test
    void verifyCodeSucceedsAndRemovesCodeOnFirstAttempt() {
        String phone = "13800000000";
        String code = "123456";
        store.put(phone, code);

        boolean result = verificationCodeService.verifyCode(phone, code);

        assertThat(result).isTrue();
        assertThat(store.get(phone)).isNull();
    }

    @Test
    void verifyCodeFailsAndIncrementsAttemptsOnIncorrectCode() {
        String phone = "13800000000";
        String code = "123456";
        store.put(phone, code);

        boolean result = verificationCodeService.verifyCode(phone, "654321");

        assertThat(result).isFalse();
        VerificationCodeStore.CodeEntry entry = store.get(phone);
        assertThat(entry).isNotNull();
        assertThat(entry.attempts()).isEqualTo(1);
    }

    @Test
    void verifyCodeThrowsOnMaxAttemptsReached() {
        String phone = "13800000000";
        String code = "123456";
        store.put(phone, code);

        // Fail 5 times
        for (int i = 0; i < 5; i++) {
            boolean result = verificationCodeService.verifyCode(phone, "wrong");
            assertThat(result).isFalse();
        }

        assertThatThrownBy(() -> verificationCodeService.verifyCode(phone, code))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("验证码尝试次数过多");
    }

    @Test
    void verifyCodeHandlesConcurrencyByRejectingDuplicateValidation() {
        String phone = "13800000000";
        String code = "123456";
        store.put(phone, code);

        VerificationCodeStore.CodeEntry entry = store.get(phone);

        // Spy store to return false for the second call to remove(phone, entry)
        // representing a concurrent thread already removing the code entry.
        doReturn(false).when(store).remove(phone, entry);

        assertThatThrownBy(() -> verificationCodeService.verifyCode(phone, code))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("验证码已被核销");
    }
}
