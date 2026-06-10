package com.klarheit.backend.auth;

import com.klarheit.backend.auth.dto.AuthResponseDTO;
import com.klarheit.backend.auth.dto.LoginRequestDTO;
import com.klarheit.backend.auth.dto.RegisterRequestDTO;
import com.klarheit.backend.auth.dto.UserProfileDTO;
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

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponseDTO> register(@Valid @RequestBody RegisterRequestDTO request, jakarta.servlet.http.HttpServletResponse response) {
        AuthResponseDTO authResponse = authService.register(request);
        setJwtCookie(response, authResponse.token());
        return ResponseEntity.ok(new AuthResponseDTO(null, authResponse.user()));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponseDTO> login(@Valid @RequestBody LoginRequestDTO request, jakarta.servlet.http.HttpServletResponse response) {
        AuthResponseDTO authResponse = authService.login(request);
        setJwtCookie(response, authResponse.token());
        return ResponseEntity.ok(new AuthResponseDTO(null, authResponse.user()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(jakarta.servlet.http.HttpServletResponse response) {
        org.springframework.http.ResponseCookie cookie = org.springframework.http.ResponseCookie.from("klarheit_auth_token", "")
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(0)
                .sameSite("Strict")
                .build();
        response.addHeader(org.springframework.http.HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileDTO> me(Authentication authentication) {
        return ResponseEntity.ok(authService.getCurrentUser(authentication.getName()));
    }

    private void setJwtCookie(jakarta.servlet.http.HttpServletResponse response, String token) {
        org.springframework.http.ResponseCookie cookie = org.springframework.http.ResponseCookie.from("klarheit_auth_token", token)
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(86400) // 1 day
                .sameSite("Strict")
                .build();
        response.addHeader(org.springframework.http.HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
