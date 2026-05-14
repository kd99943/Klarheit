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
}
