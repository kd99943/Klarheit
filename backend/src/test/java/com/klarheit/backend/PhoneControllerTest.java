package com.klarheit.backend;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.auth.dto.SendCodeRequestDTO;
import com.klarheit.backend.auth.dto.VerifyCodeRequestDTO;
import com.klarheit.backend.config.ApiExceptionHandler;
import com.klarheit.backend.sms.PhoneController;
import com.klarheit.backend.sms.VerificationCodeService;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class PhoneControllerTest {

    private MockMvc mockMvc;

    @Mock
    private VerificationCodeService verificationCodeService;

    @Mock
    private UserAccountRepository userAccountRepository;

    @InjectMocks
    private PhoneController phoneController;

    private Authentication mockAuthentication;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(phoneController)
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
        mockAuthentication = mock(Authentication.class);
        lenient().when(mockAuthentication.getName()).thenReturn("user@example.com");
        objectMapper = new ObjectMapper();
    }

    @Test
    void sendCodeSuccessfully() throws Exception {
        SendCodeRequestDTO request = new SendCodeRequestDTO("13812345678");

        doNothing().when(verificationCodeService).sendCode("13812345678");

        mockMvc.perform(post("/api/v1/phone/send-code")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        verify(verificationCodeService).sendCode("13812345678");
    }

    @Test
    void verifyAndBindSuccessfullyWhenCodeIsValidAndNoPriorBinding() throws Exception {
        VerifyCodeRequestDTO request = new VerifyCodeRequestDTO("13812345678", "123456");
        UserAccount user = UserAccount.builder()
                .email("user@example.com")
                .phone(null)
                .phoneVerified(false)
                .build();

        when(verificationCodeService.verifyCode("13812345678", "123456")).thenReturn(true);
        when(userAccountRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));
        when(userAccountRepository.existsByPhone("13812345678")).thenReturn(false);

        mockMvc.perform(post("/api/v1/phone/verify-and-bind")
                        .principal(mockAuthentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        verify(userAccountRepository).save(user);
        org.assertj.core.api.Assertions.assertThat(user.getPhone()).isEqualTo("13812345678");
        org.assertj.core.api.Assertions.assertThat(user.isPhoneVerified()).isTrue();
    }

    @Test
    void verifyAndBindSuccessfullyWhenPhoneAlreadyAssignedToThisUser() throws Exception {
        VerifyCodeRequestDTO request = new VerifyCodeRequestDTO("13812345678", "123456");
        UserAccount user = UserAccount.builder()
                .email("user@example.com")
                .phone("13812345678")
                .phoneVerified(false)
                .build();

        when(verificationCodeService.verifyCode("13812345678", "123456")).thenReturn(true);
        when(userAccountRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));

        mockMvc.perform(post("/api/v1/phone/verify-and-bind")
                        .principal(mockAuthentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        verify(userAccountRepository).save(user);
        org.assertj.core.api.Assertions.assertThat(user.isPhoneVerified()).isTrue();
    }

    @Test
    void verifyAndBindThrowsErrorIfCodeIsInvalid() throws Exception {
        VerifyCodeRequestDTO request = new VerifyCodeRequestDTO("13812345678", "000000");

        when(verificationCodeService.verifyCode("13812345678", "000000")).thenReturn(false);

        mockMvc.perform(post("/api/v1/phone/verify-and-bind")
                        .principal(mockAuthentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("验证码错误"));

        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void verifyAndBindThrowsErrorIfPhoneAlreadyBoundToAnotherUser() throws Exception {
        VerifyCodeRequestDTO request = new VerifyCodeRequestDTO("13812345678", "123456");
        UserAccount user = UserAccount.builder()
                .email("user@example.com")
                .phone(null)
                .phoneVerified(false)
                .build();

        when(verificationCodeService.verifyCode("13812345678", "123456")).thenReturn(true);
        when(userAccountRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));
        when(userAccountRepository.existsByPhone("13812345678")).thenReturn(true);

        mockMvc.perform(post("/api/v1/phone/verify-and-bind")
                        .principal(mockAuthentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("该手机号已被其他账户绑定"));

        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void getPhoneStatusReturnsMaskedPhoneAndStatus() throws Exception {
        UserAccount user = UserAccount.builder()
                .email("user@example.com")
                .phone("13812345678")
                .phoneVerified(true)
                .build();

        when(userAccountRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));

        mockMvc.perform(get("/api/v1/phone/status")
                        .principal(mockAuthentication)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maskedPhone").value("138****5678"))
                .andExpect(jsonPath("$.verified").value(true));
    }

    @Test
    void getPhoneStatusReturnsNullWhenPhoneNotSet() throws Exception {
        UserAccount user = UserAccount.builder()
                .email("user@example.com")
                .phone(null)
                .phoneVerified(false)
                .build();

        when(userAccountRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));

        mockMvc.perform(get("/api/v1/phone/status")
                        .principal(mockAuthentication)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maskedPhone").isEmpty())
                .andExpect(jsonPath("$.verified").value(false));
    }
}
