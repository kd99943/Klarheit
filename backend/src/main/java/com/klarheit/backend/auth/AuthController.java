package com.klarheit.backend.auth;

import com.klarheit.backend.auth.dto.AuthResponseDTO;
import com.klarheit.backend.auth.dto.LoginRequestDTO;
import com.klarheit.backend.auth.dto.RegisterRequestDTO;
import com.klarheit.backend.auth.dto.ResetPasswordRequestDTO;
import com.klarheit.backend.auth.dto.UserProfileDTO;
import com.klarheit.backend.sms.VerificationCodeService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService authService;
    private final VerificationCodeService verificationCodeService;

    public AuthController(AuthService authService, VerificationCodeService verificationCodeService) {
        this.authService = authService;
        this.verificationCodeService = verificationCodeService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponseDTO> register(@Valid @RequestBody RegisterRequestDTO request,
                                                     jakarta.servlet.http.HttpServletRequest httpRequest,
                                                     jakarta.servlet.http.HttpServletResponse response) {
        AuthResponseDTO authResponse = authService.register(request);
        setJwtCookie(response, authResponse.token(), httpRequest);
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponseDTO> login(@Valid @RequestBody LoginRequestDTO request,
                                                jakarta.servlet.http.HttpServletRequest httpRequest,
                                                jakarta.servlet.http.HttpServletResponse response) {
        AuthResponseDTO authResponse = authService.login(request);
        setJwtCookie(response, authResponse.token(), httpRequest);
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(jakarta.servlet.http.HttpServletRequest httpRequest,
                                        jakarta.servlet.http.HttpServletResponse response) {
        boolean secure = httpRequest.isSecure();
        org.springframework.http.ResponseCookie cookie = org.springframework.http.ResponseCookie.from("klarheit_auth_token", "")
                .httpOnly(true)
                .secure(secure)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader(org.springframework.http.HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileDTO> me(Authentication authentication) {
        return ResponseEntity.ok(authService.getCurrentUser(authentication.getName()));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ResetPasswordRequestDTO request) {
        boolean valid = verificationCodeService.verifyCode(request.phone(), request.code());
        if (!valid) {
            throw new IllegalArgumentException("验证码错误");
        }
        authService.resetPassword(request.phone(), request.newPassword());
        return ResponseEntity.ok().build();
    }

    private void setJwtCookie(jakarta.servlet.http.HttpServletResponse response, String token,
                              jakarta.servlet.http.HttpServletRequest request) {
        // Use the actual request scheme so that on plain HTTP (local dev) the
        // browser stores the cookie, while on HTTPS (production) it stays Secure.
        boolean secure = request.isSecure();
        org.springframework.http.ResponseCookie cookie = org.springframework.http.ResponseCookie.from("klarheit_auth_token", token)
                .httpOnly(true)
                .secure(secure)
                .path("/")
                .maxAge(86400) // 1 day
                .sameSite("Lax") // Lax mitigates CSRF for same-origin top-level navigations while still allowing the cookie to be sent on cross-site requests initiated by top-level GET navigation (e.g. payment return).
                .build();
        response.addHeader(org.springframework.http.HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
