# Phone Binding & SMS Password Recovery Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add phone number binding with SMS verification, and SMS-based password recovery for Chinese users.

**Architecture:** Pluggable SMS service (Alibaba Cloud for production, mock for dev) + in-memory verification code store with TTL. Backend adds phone field to UserAccount, new verification endpoints, and a forgot-password flow. Frontend adds phone binding UI on profile page and forgot-password flow in auth drawer.

**Tech Stack:** Spring Boot 3.4, Alibaba Cloud SMS SDK, Bucket4j (rate limiting), React + TypeScript, i18next

---

## PM Decision Log

### Why phone binding?
- Chinese users expect phone-based identity (WeChat, Taobao, Alipay pattern)
- Phone is a stronger identity signal than email in China
- Enables SMS password recovery (reduces support tickets)
- Future: phone+SMS-code login (passwordless)

### Why not Redis for verification codes?
- Current stack has no Redis dependency — adding one increases ops complexity
- In-memory store with ScheduledExecutorService cleanup is sufficient for early stage
- If scale demands it later, swap to Redis (same interface)

### SMS Provider: Alibaba Cloud SMS
- Standard choice for China market, ~0.045 CNY/SMS
- Requires: AccessKey ID/Secret, SMS SignName, Template Code
- Dev mode: Mock service that logs codes to console

### Security Design
- 6-digit numeric code, 5-minute TTL
- 60-second cooldown between sends (per phone)
- Max 5 wrong attempts per code (auto-invalidate after)
- Phone format: Chinese mobile `1[3-9]X-XXXX-XXXX` (11 digits)
- One phone per account (unique constraint)
- Rate limiting via existing bucket4j infrastructure

### User Flows
1. **Bind Phone** (auth required): Profile page → "绑定手机号" → enter phone → receive SMS → enter code → bound
2. **Forgot Password** (no auth): Login drawer → "忘记密码?" → enter phone → receive SMS → enter code → set new password → auto-login

---

## File Structure

### Backend (New Files)
- `backend/src/main/java/com/klarheit/backend/sms/SmsService.java` — Interface
- `backend/src/main/java/com/klarheit/backend/sms/MockSmsService.java` — Dev implementation (logs to console)
- `backend/src/main/java/com/klarheit/backend/sms/AlibabaSmsService.java` — Production implementation
- `backend/src/main/java/com/klarheit/backend/sms/VerificationCodeService.java` — Code generation, storage, validation
- `backend/src/main/java/com/klarheit/backend/sms/VerificationCodeStore.java` — In-memory store with TTL
- `backend/src/main/java/com/klarheit/backend/sms/PhoneController.java` — Phone binding endpoints
- `backend/src/main/java/com/klarheit/backend/auth/dto/SendCodeRequestDTO.java` — Request DTO
- `backend/src/main/java/com/klarheit/backend/auth/dto/VerifyCodeRequestDTO.java` — Request DTO
- `backend/src/main/java/com/klarheit/backend/auth/dto/ResetPasswordRequestDTO.java` — Request DTO
- `backend/src/main/java/com/klarheit/backend/auth/dto/PhoneStatusDTO.java` — Response DTO

### Backend (Modified Files)
- `backend/src/main/java/com/klarheit/backend/auth/UserAccount.java` — Add phone, phoneVerified fields
- `backend/src/main/java/com/klarheit/backend/auth/UserAccountRepository.java` — Add findByPhone
- `backend/src/main/java/com/klarheit/backend/auth/dto/UserProfileDTO.java` — Add phone, phoneVerified
- `backend/src/main/java/com/klarheit/backend/auth/AuthService.java` — Add resetPassword method
- `backend/src/main/java/com/klarheit/backend/auth/AuthController.java` — Add forgot-password endpoint
- `backend/src/main/java/com/klarheit/backend/security/SecurityConfig.java` — Permit phone/sms endpoints
- `backend/src/main/resources/application.yml` — Add SMS config
- `backend/.env.example` — Add SMS env vars
- `backend/src/main/resources/db/migration/V10__add_phone_to_users.sql` — DB migration

### Frontend (New Files)
- `front_end/src/components/auth/ForgotPasswordFlow.tsx` — Multi-step forgot password UI

### Frontend (Modified Files)
- `front_end/src/services/api.ts` — Add phone/SMS API functions
- `front_end/src/pages/ProfileDetailsPage.tsx` — Replace phone placeholder with binding UI
- `front_end/src/components/auth/AuthDrawer.tsx` — Add "忘记密码" link and flow
- `front_end/src/i18n/locales/zh/profile.json` — Add phone binding i18n
- `front_end/src/i18n/locales/en/profile.json` — Add phone binding i18n
- `front_end/src/i18n/locales/zh/common.json` — Add forgot password i18n
- `front_end/src/i18n/locales/en/common.json` — Add forgot password i18n
- `front_end/src/auth/AuthProvider.tsx` — Add resetPassword method

---

## Task 1: Database Migration — Add Phone Fields

**Files:**
- Create: `backend/src/main/resources/db/migration/V10__add_phone_to_users.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
ALTER TABLE users
    ADD COLUMN phone VARCHAR(20) NULL AFTER email,
    ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER phone;

CREATE UNIQUE INDEX uk_users_phone ON users (phone) WHERE phone IS NOT NULL;
```

Note: MySQL doesn't support partial indexes. Use:
```sql
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX uk_users_phone ON users (phone);
```

- [ ] **Step 2: Verify migration syntax**

Run: Check that Flyway can parse the migration (will validate on next app start).

---

## Task 2: Backend Entity & Repository — Add Phone Fields

**Files:**
- Modify: `backend/src/main/java/com/klarheit/backend/auth/UserAccount.java`
- Modify: `backend/src/main/java/com/klarheit/backend/auth/UserAccountRepository.java`
- Modify: `backend/src/main/java/com/klarheit/backend/auth/dto/UserProfileDTO.java`

- [ ] **Step 1: Add phone fields to UserAccount entity**

Add after the `email` field:
```java
@Column(name = "phone", length = 20)
private String phone;

@Column(name = "phone_verified", nullable = false)
private boolean phoneVerified = false;
```

Add getters/setters and builder methods:
```java
public String getPhone() { return phone; }
public boolean isPhoneVerified() { return phoneVerified; }
public void setPhone(String phone) { this.phone = phone; }
public void setPhoneVerified(boolean phoneVerified) { this.phoneVerified = phoneVerified; }
```

In Builder:
```java
public Builder phone(String phone) { instance.phone = phone; return this; }
public Builder phoneVerified(boolean phoneVerified) { instance.phoneVerified = phoneVerified; return this; }
```

- [ ] **Step 2: Add repository methods**

```java
Optional<UserAccount> findByPhone(String phone);
boolean existsByPhone(String phone);
```

- [ ] **Step 3: Update UserProfileDTO**

```java
public record UserProfileDTO(Long id, String email, String firstName, String lastName, String phone, boolean phoneVerified) {}
```

- [ ] **Step 4: Update AuthService.toUserProfile**

```java
private UserProfileDTO toUserProfile(UserAccount user) {
    return new UserProfileDTO(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName(), user.getPhone(), user.isPhoneVerified());
}
```

---

## Task 3: Backend SMS Service — Interface & Mock

**Files:**
- Create: `backend/src/main/java/com/klarheit/backend/sms/SmsService.java`
- Create: `backend/src/main/java/com/klarheit/backend/sms/MockSmsService.java`

- [ ] **Step 1: Create SmsService interface**

```java
package com.klarheit.backend.sms;

public interface SmsService {
    void sendVerificationCode(String phone, String code);
}
```

- [ ] **Step 2: Create MockSmsService**

```java
package com.klarheit.backend.sms;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@Profile("local")
public class MockSmsService implements SmsService {
    @Override
    public void sendVerificationCode(String phone, String code) {
        log.info("=== MOCK SMS === To: {} Code: {}", phone, code);
    }
}
```

---

## Task 4: Backend Verification Code — Store & Service

**Files:**
- Create: `backend/src/main/java/com/klarheit/backend/sms/VerificationCodeStore.java`
- Create: `backend/src/main/java/com/klarheit/backend/sms/VerificationCodeService.java`

- [ ] **Step 1: Create VerificationCodeStore**

```java
package com.klarheit.backend.sms;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

@Component
public class VerificationCodeStore {
    private static final long TTL_MILLIS = 5 * 60 * 1000; // 5 minutes
    private static final long COOLDOWN_MILLIS = 60 * 1000; // 60 seconds
    private static final int MAX_ATTEMPTS = 5;

    private final ConcurrentHashMap<String, CodeEntry> store = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lastSendTime = new ConcurrentHashMap<>();

    public VerificationCodeStore() {
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(this::cleanup, 1, 1, TimeUnit.MINUTES);
    }

    public record CodeEntry(String code, long createdAt, int attempts) {}

    public void put(String phone, String code) {
        store.put(phone, new CodeEntry(code, System.currentTimeMillis(), 0));
        lastSendTime.put(phone, System.currentTimeMillis());
    }

    public CodeEntry get(String phone) {
        return store.get(phone);
    }

    public void incrementAttempts(String phone) {
        CodeEntry entry = store.get(phone);
        if (entry != null) {
            store.put(phone, new CodeEntry(entry.code(), entry.createdAt(), entry.attempts() + 1));
        }
    }

    public void remove(String phone) {
        store.remove(phone);
    }

    public boolean isOnCooldown(String phone) {
        Long lastSend = lastSendTime.get(phone);
        return lastSend != null && (System.currentTimeMillis() - lastSend) < COOLDOWN_MILLIS;
    }

    public long getCooldownRemaining(String phone) {
        Long lastSend = lastSendTime.get(phone);
        if (lastSend == null) return 0;
        long elapsed = System.currentTimeMillis() - lastSend;
        return Math.max(0, COOLDOWN_MILLIS - elapsed);
    }

    public boolean isExpired(CodeEntry entry) {
        return (System.currentTimeMillis() - entry.createdAt()) > TTL_MILLIS;
    }

    public boolean isMaxAttemptsReached(CodeEntry entry) {
        return entry.attempts() >= MAX_ATTEMPTS;
    }

    private void cleanup() {
        long now = System.currentTimeMillis();
        store.entrySet().removeIf(e -> (now - e.getValue().createdAt()) > TTL_MILLIS);
        lastSendTime.entrySet().removeIf(e -> (now - e.getValue()) > COOLDOWN_MILLIS);
    }
}
```

- [ ] **Step 2: Create VerificationCodeService**

```java
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
            long remaining = store.getCooldownRemaining(phone);
            throw new IllegalStateException("请在 " + (remaining / 1000) + " 秒后重试");
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
            throw new IllegalStateException("验证码尝试次数过多");
        }

        store.incrementAttempts(phone);

        if (!entry.code().equals(code)) {
            return false;
        }

        store.remove(phone);
        return true;
    }
}
```

---

## Task 5: Backend DTOs & PhoneController

**Files:**
- Create: `backend/src/main/java/com/klarheit/backend/auth/dto/SendCodeRequestDTO.java`
- Create: `backend/src/main/java/com/klarheit/backend/auth/dto/VerifyCodeRequestDTO.java`
- Create: `backend/src/main/java/com/klarheit/backend/auth/dto/ResetPasswordRequestDTO.java`
- Create: `backend/src/main/java/com/klarheit/backend/sms/PhoneController.java`

- [ ] **Step 1: Create DTOs**

```java
// SendCodeRequestDTO.java
package com.klarheit.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record SendCodeRequestDTO(
    @NotBlank(message = "手机号不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "请输入有效的手机号")
    String phone
) {}
```

```java
// VerifyCodeRequestDTO.java
package com.klarheit.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record VerifyCodeRequestDTO(
    @NotBlank String phone,
    @NotBlank @Size(min = 6, max = 6) String code
) {}
```

```java
// ResetPasswordRequestDTO.java
package com.klarheit.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequestDTO(
    @NotBlank String phone,
    @NotBlank @Size(min = 6, max = 6) String code,
    @NotBlank @Size(min = 8, message = "密码至少8个字符") String newPassword
) {}
```

- [ ] **Step 2: Create PhoneController**

```java
package com.klarheit.backend.sms;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.auth.dto.SendCodeRequestDTO;
import com.klarheit.backend.auth.dto.VerifyCodeRequestDTO;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/phone")
public class PhoneController {
    private final VerificationCodeService verificationCodeService;
    private final UserAccountRepository userAccountRepository;

    public PhoneController(VerificationCodeService verificationCodeService, UserAccountRepository userAccountRepository) {
        this.verificationCodeService = verificationCodeService;
        this.userAccountRepository = userAccountRepository;
    }

    @PostMapping("/send-code")
    public ResponseEntity<Void> sendCode(@Valid @RequestBody SendCodeRequestDTO request) {
        verificationCodeService.sendCode(request.phone());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/verify-and-bind")
    public ResponseEntity<Void> verifyAndBind(@Valid @RequestBody VerifyCodeRequestDTO request, Authentication authentication) {
        boolean valid = verificationCodeService.verifyCode(request.phone(), request.code());
        if (!valid) {
            throw new IllegalArgumentException("验证码错误");
        }

        String email = authentication.getName();
        UserAccount user = userAccountRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        if (userAccountRepository.existsByPhone(request.phone())) {
            throw new IllegalArgumentException("该手机号已被其他账户绑定");
        }

        user.setPhone(request.phone());
        user.setPhoneVerified(true);
        userAccountRepository.save(user);

        return ResponseEntity.ok().build();
    }

    @GetMapping("/status")
    public ResponseEntity<PhoneStatusDTO> getPhoneStatus(Authentication authentication) {
        String email = authentication.getName();
        UserAccount user = userAccountRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        String maskedPhone = null;
        if (user.getPhone() != null && user.getPhone().length() >= 7) {
            maskedPhone = user.getPhone().substring(0, 3) + "****" + user.getPhone().substring(7);
        }

        return ResponseEntity.ok(new PhoneStatusDTO(maskedPhone, user.isPhoneVerified()));
    }

    record PhoneStatusDTO(String maskedPhone, boolean verified) {}
}
```

---

## Task 6: Backend Forgot Password Endpoint

**Files:**
- Modify: `backend/src/main/java/com/klarheit/backend/auth/AuthController.java`
- Modify: `backend/src/main/java/com/klarheit/backend/auth/AuthService.java`
- Modify: `backend/src/main/java/com/klarheit/backend/security/SecurityConfig.java`

- [ ] **Step 1: Add resetPassword to AuthService**

```java
public void resetPassword(String phone, String code, String newPassword) {
    // Verify the code first
    // Note: This requires injecting VerificationCodeService - handle in controller instead

    UserAccount user = userAccountRepository.findByPhone(phone)
            .orElseThrow(() -> new IllegalArgumentException("该手机号未注册"));

    user.setPasswordHash(passwordEncoder.encode(newPassword));
    userAccountRepository.save(user);
    log.info("Password reset via SMS for phone: {}", phone);
}
```

- [ ] **Step 2: Add forgot-password endpoint to AuthController**

Inject VerificationCodeService into AuthController, then:

```java
@PostMapping("/forgot-password")
public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ResetPasswordRequestDTO request) {
    boolean valid = verificationCodeService.verifyCode(request.phone(), request.code());
    if (!valid) {
        throw new IllegalArgumentException("验证码错误");
    }
    authService.resetPassword(request.phone(), request.newPassword());
    return ResponseEntity.ok().build();
}
```

- [ ] **Step 3: Update SecurityConfig to permit phone endpoints**

Add to the permitAll list:
```java
.requestMatchers("/api/v1/phone/send-code").permitAll()
```

Note: `/api/v1/phone/verify-and-bind` and `/api/v1/phone/status` require auth (they use Authentication). The forgot-password endpoint is under `/api/v1/auth/**` which is already permitted.

---

## Task 7: Backend Config & Alibaba SMS Service

**Files:**
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/.env.example`
- Create: `backend/src/main/java/com/klarheit/backend/sms/AlibabaSmsService.java`

- [ ] **Step 1: Add SMS config to application.yml**

```yaml
app:
  sms:
    provider: ${SMS_PROVIDER:mock}
    alibaba:
      access-key-id: ${SMS_ACCESS_KEY_ID:}
      access-key-secret: ${SMS_ACCESS_KEY_SECRET:}
      sign-name: ${SMS_SIGN_NAME:Klarheit}
      template-code: ${SMS_TEMPLATE_CODE:}
```

- [ ] **Step 2: Add env vars to .env.example**

```
# SMS Configuration (Alibaba Cloud)
# Provider: "mock" for development, "alibaba" for production
SMS_PROVIDER=mock
SMS_ACCESS_KEY_ID=
SMS_ACCESS_KEY_SECRET=
SMS_SIGN_NAME=Klarheit
SMS_TEMPLATE_CODE=
```

- [ ] **Step 3: Create AlibabaSmsService**

```java
package com.klarheit.backend.sms;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@Profile("prod")
public class AlibabaSmsService implements SmsService {

    @Value("${app.sms.alibaba.access-key-id}")
    private String accessKeyId;

    @Value("${app.sms.alibaba.access-key-secret}")
    private String accessKeySecret;

    @Value("${app.sms.alibaba.sign-name}")
    private String signName;

    @Value("${app.sms.alibaba.template-code}")
    private String templateCode;

    @Override
    public void sendVerificationCode(String phone, String code) {
        try {
            com.aliyun.dysmsapi20170525.models.SendSmsRequest request =
                new com.aliyun.dysmsapi20170525.models.SendSmsRequest()
                    .setPhoneNumbers(phone)
                    .setSignName(signName)
                    .setTemplateCode(templateCode)
                    .setTemplateParam("{\"code\":\"" + code + "\"}");

            com.aliyun.teaopenapi.models.Config config = new com.aliyun.teaopenapi.models.Config()
                .setAccessKeyId(accessKeyId)
                .setAccessKeySecret(accessKeySecret)
                .setEndpoint("dysmsapi.aliyuncs.com");

            com.aliyun.dysmsapi20170525.Client client = new com.aliyun.dysmsapi20170525.Client(config);
            com.aliyun.dysmsapi20170525.models.SendSmsResponse response = client.sendSms(request);

            if (!"OK".equals(response.getBody().getCode())) {
                log.error("SMS send failed: {}", response.getBody().getMessage());
                throw new RuntimeException("短信发送失败");
            }

            log.info("SMS sent to {}", phone);
        } catch (Exception e) {
            log.error("SMS send error", e);
            throw new RuntimeException("短信发送失败，请稍后重试");
        }
    }
}
```

Note: Alibaba SMS SDK dependency needs to be added to pom.xml:
```xml
<dependency>
    <groupId>com.aliyun</groupId>
    <artifactId>dysmsapi20170525</artifactId>
    <version>2.2.1</version>
</dependency>
```

---

## Task 8: Frontend API Functions

**Files:**
- Modify: `front_end/src/services/api.ts`

- [ ] **Step 1: Add phone/SMS API types and functions**

```typescript
export interface PhoneStatus {
  maskedPhone: string | null;
  verified: boolean;
}

export function sendSmsCode(phone: string): Promise<void> {
  return request<void>("/phone/send-code", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function verifyAndBindPhone(phone: string, code: string): Promise<void> {
  return request<void>("/phone/verify-and-bind", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export function getPhoneStatus(): Promise<PhoneStatus> {
  return request<PhoneStatus>("/phone/status");
}

export function resetPasswordViaSms(phone: string, code: string, newPassword: string): Promise<void> {
  return request<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ phone, code, newPassword }),
  });
}
```

---

## Task 9: Frontend i18n — Phone Binding & Forgot Password

**Files:**
- Modify: `front_end/src/i18n/locales/zh/profile.json`
- Modify: `front_end/src/i18n/locales/en/profile.json`
- Modify: `front_end/src/i18n/locales/zh/common.json`
- Modify: `front_end/src/i18n/locales/en/common.json`

- [ ] **Step 1: Add phone binding i18n to profile.json (zh)**

Add under `personalInfo`:
```json
"phoneBound": "手机号已绑定",
"phoneNotBound": "尚未绑定手机号",
"bindPhone": "绑定手机号",
"unbindPhone": "解绑手机号",
"enterPhone": "请输入手机号",
"enterCode": "请输入验证码",
"sendCode": "发送验证码",
"resendCode": "重新发送",
"codeSent": "验证码已发送",
"verify": "验证",
"bindSuccess": "手机号绑定成功",
"invalidPhone": "请输入有效的手机号",
"codeCooldown": "{seconds}秒后可重新发送"
```

- [ ] **Step 2: Add phone binding i18n to profile.json (en)**

Same keys with English values.

- [ ] **Step 3: Add forgot password i18n to common.json (zh)**

Add under `auth`:
```json
"forgotPassword": "忘记密码?",
"resetPassword": "重置密码",
"resetPasswordDesc": "输入绑定的手机号，通过验证码重置密码",
"newPassword": "新密码",
"confirmNewPassword": "确认新密码",
"passwordResetSuccess": "密码重置成功",
"backToSignIn": "返回登录"
```

- [ ] **Step 4: Add forgot password i18n to common.json (en)**

Same keys with English values.

---

## Task 10: Frontend — Phone Binding in ProfileDetailsPage

**Files:**
- Modify: `front_end/src/pages/ProfileDetailsPage.tsx`

- [ ] **Step 1: Replace phone placeholder with interactive binding UI**

Replace the static phone section with a component that:
- Shows bound phone with masked number and "verified" badge if bound
- Shows "绑定手机号" button if not bound
- On click, opens an inline flow: phone input → send code → verify code → success
- Uses `getPhoneStatus()`, `sendSmsCode()`, `verifyAndBindPhone()` APIs

Key UX:
- Phone input with "+86" prefix
- 60-second countdown after sending code
- Loading states on buttons
- Success/error feedback
- Refresh user data after binding

---

## Task 11: Frontend — Forgot Password Flow in AuthDrawer

**Files:**
- Modify: `front_end/src/components/auth/AuthDrawer.tsx`
- Create: `front_end/src/components/auth/ForgotPasswordFlow.tsx`

- [ ] **Step 1: Create ForgotPasswordFlow component**

Multi-step flow:
1. **Step 1 - Enter phone**: Phone input + "发送验证码" button
2. **Step 2 - Enter code**: 6-digit code input + "验证" button
3. **Step 3 - Set new password**: New password + confirm + "重置密码" button
4. **Success**: Show success message + "返回登录" button

Uses `sendSmsCode()`, `verifyAndBindPhone()` (to verify code), `resetPasswordViaSms()` APIs.

- [ ] **Step 2: Add "忘记密码?" link to AuthDrawer**

In the signin form, add a link below the password field:
```tsx
<button
  type="button"
  onClick={() => setShowForgotPassword(true)}
  className="text-xs text-slate-400 hover:text-brand-primary transition-colors"
>
  {t("auth.forgotPassword")}
</button>
```

When clicked, swap the form content to show `ForgotPasswordFlow`.

---

## Task 12: Frontend — Update AuthProvider for Phone Data

**Files:**
- Modify: `front_end/src/auth/AuthProvider.tsx`

- [ ] **Step 1: Update UserProfile type to include phone**

The `UserProfile` interface in `api.ts` already needs updating:
```typescript
export interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  phoneVerified: boolean;
}
```

- [ ] **Step 2: Add refreshUser method to AuthProvider**

```typescript
const refreshUser = useCallback(async () => {
  try {
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
  } catch {
    // silent
  }
}, []);
```

Expose it in the context value so ProfileDetailsPage can call it after phone binding.

---

## Verification Checklist

- [ ] Flyway migration V10 applies cleanly on MySQL
- [ ] MockSmsService logs verification codes to console
- [ ] Phone send-code endpoint returns 200
- [ ] Phone verify-and-bind endpoint binds phone to authenticated user
- [ ] Phone status endpoint returns masked phone
- [ ] Forgot-password endpoint resets password via SMS code
- [ ] Rate limiting works (60s cooldown between sends)
- [ ] Profile page shows phone binding UI
- [ ] Auth drawer shows "忘记密码?" link
- [ ] Forgot password flow works end-to-end
- [ ] i18n works for both zh and en
- [ ] TypeScript check passes
- [ ] Vite build succeeds
