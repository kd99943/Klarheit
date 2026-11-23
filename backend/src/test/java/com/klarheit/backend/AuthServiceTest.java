package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.klarheit.backend.auth.AuthService;
import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.auth.dto.AuthResponseDTO;
import com.klarheit.backend.auth.dto.LoginRequestDTO;
import com.klarheit.backend.auth.dto.RegisterRequestDTO;
import com.klarheit.backend.security.JwtService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserAccountRepository userAccountRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;

    @InjectMocks
    private AuthService authService;

    @Test
    void registerNormalizesEmailToLowerCase() {
        RegisterRequestDTO request = new RegisterRequestDTO(
                "John", "Doe", "  Test@Example.COM  ", "Password123"
        );

        when(userAccountRepository.existsByEmailIgnoreCase("test@example.com")).thenReturn(false);
        when(passwordEncoder.encode("Password123")).thenReturn("hashed");
        when(jwtService.generateToken("test@example.com")).thenReturn("token");

        UserAccount savedUser = UserAccount.builder()
                .id(1L)
                .email("test@example.com")
                .firstName("John")
                .lastName("Doe")
                .passwordHash("hashed")
                .build();
        when(userAccountRepository.save(any(UserAccount.class))).thenReturn(savedUser);

        AuthResponseDTO response = authService.register(request);

        ArgumentCaptor<UserAccount> captor = ArgumentCaptor.forClass(UserAccount.class);
        verify(userAccountRepository).save(captor.capture());
        assertThat(captor.getValue().getEmail()).isEqualTo("test@example.com");
        assertThat(response.user().email()).isEqualTo("test@example.com");
    }

    @Test
    void registerRejectsDuplicateEmail() {
        RegisterRequestDTO request = new RegisterRequestDTO(
                "John", "Doe", "existing@example.com", "Password123"
        );

        when(userAccountRepository.existsByEmailIgnoreCase("existing@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("An account with this email already exists");
    }

    @Test
    void loginNormalizesEmail() {
        LoginRequestDTO request = new LoginRequestDTO("  Test@Example.COM  ", "Password123");

        UserAccount user = UserAccount.builder()
                .id(1L)
                .email("test@example.com")
                .firstName("Test")
                .lastName("User")
                .passwordHash("hashed")
                .build();

        when(userAccountRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("Password123", "hashed")).thenReturn(true);
        when(jwtService.generateToken("test@example.com")).thenReturn("token");

        AuthResponseDTO response = authService.login(request);

        assertThat(response.user().email()).isEqualTo("test@example.com");
    }

    @Test
    void loginRejectsWrongPassword() {
        LoginRequestDTO request = new LoginRequestDTO("test@example.com", "wrongpassword");

        UserAccount user = UserAccount.builder()
                .id(1L)
                .email("test@example.com")
                .firstName("Test")
                .lastName("User")
                .passwordHash("hashed")
                .build();

        when(userAccountRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongpassword", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid email or password");
    }

    @Test
    void loginRejectsNonExistentEmail() {
        LoginRequestDTO request = new LoginRequestDTO("nonexistent@example.com", "Password123");

        when(userAccountRepository.findByEmailIgnoreCase("nonexistent@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid email or password");
    }

    @Test
    void getCurrentUser_success() {
        String email = "john@example.com";
        UserAccount user = UserAccount.builder()
                .id(10L)
                .email(email)
                .firstName("John")
                .lastName("Doe")
                .phone("13812345678")
                .phoneVerified(true)
                .role("USER")
                .build();

        when(userAccountRepository.findByEmailIgnoreCase(email)).thenReturn(Optional.of(user));

        com.klarheit.backend.auth.dto.UserProfileDTO profile = authService.getCurrentUser(email);

        assertThat(profile).isNotNull();
        assertThat(profile.id()).isEqualTo(10L);
        assertThat(profile.email()).isEqualTo(email);
        assertThat(profile.firstName()).isEqualTo("John");
        assertThat(profile.lastName()).isEqualTo("Doe");
        assertThat(profile.phone()).isEqualTo("13812345678");
        assertThat(profile.phoneVerified()).isTrue();
        assertThat(profile.role()).isEqualTo("USER");

        verify(userAccountRepository).findByEmailIgnoreCase(email);
    }

    @Test
    void getCurrentUser_throwsIllegalArgumentExceptionWhenEmailNotFound() {
        String email = "nonexistent@example.com";
        when(userAccountRepository.findByEmailIgnoreCase(email)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.getCurrentUser(email))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Authenticated user could not be found.");

        verify(userAccountRepository).findByEmailIgnoreCase(email);
    }

    @Test
    void resetPassword_success() {
        String phone = "13812345678";
        String newPassword = "newPassword123";
        String encodedPassword = "encodedNewPassword";

        UserAccount user = UserAccount.builder()
                .id(10L)
                .email("john@example.com")
                .phone(phone)
                .passwordHash("old_hashed_password")
                .build();

        when(userAccountRepository.findByPhone(phone)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode(newPassword)).thenReturn(encodedPassword);
        when(userAccountRepository.save(any(UserAccount.class))).thenReturn(user);

        authService.resetPassword(phone, newPassword);

        assertThat(user.getPasswordHash()).isEqualTo(encodedPassword);
        verify(userAccountRepository).findByPhone(phone);
        verify(passwordEncoder).encode(newPassword);
        verify(userAccountRepository).save(user);
    }

    @Test
    void resetPassword_throwsIllegalArgumentExceptionIfPhoneNotRegistered() {
        String phone = "13800000000";
        String newPassword = "newPassword123";

        when(userAccountRepository.findByPhone(phone)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.resetPassword(phone, newPassword))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("该手机号未注册");

        verify(userAccountRepository).findByPhone(phone);
    }

    @Test
    void changePassword_succeedsAndRejectsWrongCurrentPassword() {
        UserAccount user = UserAccount.builder()
                .id(10L)
                .email("john@example.com")
                .passwordHash("old_hash")
                .build();
        when(userAccountRepository.findByEmailIgnoreCase("john@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong_pw", "old_hash")).thenReturn(false);

        assertThatThrownBy(() -> authService.changePassword("john@example.com", "wrong_pw", "newPassword123"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("当前密码不正确");

        when(passwordEncoder.matches("old_pw", "old_hash")).thenReturn(true);
        when(passwordEncoder.matches("newPassword123", "old_hash")).thenReturn(false);
        when(passwordEncoder.encode("newPassword123")).thenReturn("new_hash");

        authService.changePassword("john@example.com", "old_pw", "newPassword123");
        assertThat(user.getPasswordHash()).isEqualTo("new_hash");
        verify(userAccountRepository).save(user);
    }
}
