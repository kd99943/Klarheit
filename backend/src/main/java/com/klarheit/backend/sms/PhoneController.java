package com.klarheit.backend.sms;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.auth.dto.SendCodeRequestDTO;
import com.klarheit.backend.auth.dto.VerifyCodeRequestDTO;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

        if (user.getPhone() != null && user.getPhone().equals(request.phone())) {
            user.setPhoneVerified(true);
            userAccountRepository.save(user);
            return ResponseEntity.ok().build();
        }

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
        if (user.getPhone() != null && user.getPhone().length() >= 11) {
            maskedPhone = user.getPhone().substring(0, 3) + "****" + user.getPhone().substring(7);
        }

        return ResponseEntity.ok(new PhoneStatusDTO(maskedPhone, user.isPhoneVerified()));
    }

    public record PhoneStatusDTO(String maskedPhone, boolean verified) {}
}
