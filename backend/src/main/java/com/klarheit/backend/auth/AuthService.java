package com.klarheit.backend.auth;

import com.klarheit.backend.auth.dto.AuthResponseDTO;
import com.klarheit.backend.auth.dto.LoginRequestDTO;
import com.klarheit.backend.auth.dto.RegisterRequestDTO;
import com.klarheit.backend.auth.dto.UserProfileDTO;
import com.klarheit.backend.security.JwtService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class AuthService implements UserService {
    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserAccountRepository userAccountRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userAccountRepository = userAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponseDTO register(RegisterRequestDTO request) {
        String normalizedEmail = normalizeEmail(request.email());
        if (userAccountRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            log.warn("Registration attempt with existing email: {}", normalizedEmail);
            throw new IllegalArgumentException("An account with this email already exists.");
        }

        UserAccount savedUser = userAccountRepository.save(UserAccount.builder()
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(request.password()))
                .firstName(request.firstName().trim())
                .lastName(request.lastName().trim())
                .build());

        log.info("User registered successfully: {}", normalizedEmail);
        return new AuthResponseDTO(jwtService.generateToken(savedUser.getEmail()), toUserProfile(savedUser));
    }

    public AuthResponseDTO login(LoginRequestDTO request) {
        String normalizedEmail = normalizeEmail(request.email());
        UserAccount user = userAccountRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> {
                    log.warn("Login failed - email not found: {}", normalizedEmail);
                    return new IllegalArgumentException("Invalid email or password.");
                });

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            log.warn("Login failed - wrong password for: {}", normalizedEmail);
            throw new IllegalArgumentException("Invalid email or password.");
        }

        log.info("User logged in successfully: {}", normalizedEmail);
        return new AuthResponseDTO(jwtService.generateToken(user.getEmail()), toUserProfile(user));
    }

    public UserProfileDTO getCurrentUser(String email) {
        UserAccount user = userAccountRepository.findByEmailIgnoreCase(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        return toUserProfile(user);
    }

    @Override
    public java.util.Optional<UserAccount> findByEmailIgnoreCase(String email) {
        return userAccountRepository.findByEmailIgnoreCase(normalizeEmail(email));
    }

    @Override
    public java.util.Optional<UserAccount> findById(Long id) {
        return userAccountRepository.findById(id);
    }

    public void resetPassword(String phone, String newPassword) {
        UserAccount user = userAccountRepository.findByPhone(phone)
                .orElseThrow(() -> new IllegalArgumentException("该手机号未注册"));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userAccountRepository.save(user);
        log.info("Password reset via SMS for phone: {}", phone);
    }

    private UserProfileDTO toUserProfile(UserAccount user) {
        return new UserProfileDTO(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName(), user.getPhone(), user.isPhoneVerified());
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
