package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserService;
import com.klarheit.backend.prescription.Prescription;
import com.klarheit.backend.prescription.PrescriptionRepository;
import com.klarheit.backend.prescription.PrescriptionService;
import com.klarheit.backend.prescription.dto.PrescriptionPayloadDTO;
import com.klarheit.backend.prescription.dto.PrescriptionResponseDTO;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PrescriptionServiceTest {

    @Mock
    private PrescriptionRepository prescriptionRepository;

    @Mock
    private UserService userService;

    @InjectMocks
    private PrescriptionService prescriptionService;

    private UserAccount mockUser;
    private PrescriptionPayloadDTO mockPayload;

    @BeforeEach
    void setUp() {
        mockUser = UserAccount.builder()
                .id(1L)
                .email("test@example.com")
                .firstName("John")
                .lastName("Doe")
                .role("USER")
                .build();

        mockPayload = new PrescriptionPayloadDTO(
                new BigDecimal("-2.25"),
                new BigDecimal("-2.00"),
                new BigDecimal("-0.50"),
                new BigDecimal("-0.75"),
                90,
                85,
                new BigDecimal("64.50")
        );
    }

    @Test
    void testSaveSuccessWithNormalizedEmail() {
        String inputEmail = "  TEST@example.com  ";
        String normalizedEmail = "test@example.com";

        when(userService.findByEmailIgnoreCase(normalizedEmail)).thenReturn(Optional.of(mockUser));
        when(userService.findById(1L)).thenReturn(Optional.of(mockUser));
        
        when(prescriptionRepository.save(any(Prescription.class))).thenAnswer(invocation -> {
            Prescription p = invocation.getArgument(0);
            p.setId(10L);
            return p;
        });

        PrescriptionResponseDTO response = prescriptionService.save(inputEmail, mockPayload);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.userEmail()).isEqualTo("test@example.com");
        assertThat(response.sphOd()).isEqualTo(new BigDecimal("-2.25"));
        assertThat(response.sphOs()).isEqualTo(new BigDecimal("-2.00"));
        assertThat(response.cylOd()).isEqualTo(new BigDecimal("-0.50"));
        assertThat(response.cylOs()).isEqualTo(new BigDecimal("-0.75"));
        assertThat(response.axisOd()).isEqualTo(90);
        assertThat(response.axisOs()).isEqualTo(85);
        assertThat(response.pd()).isEqualTo(new BigDecimal("64.50"));

        verify(prescriptionRepository).save(any(Prescription.class));
    }

    @Test
    void testSaveThrowsExceptionWhenUserNotFound() {
        String inputEmail = "notfound@example.com";
        when(userService.findByEmailIgnoreCase("notfound@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> prescriptionService.save(inputEmail, mockPayload))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Authenticated user could not be found.");

        verify(prescriptionRepository, never()).save(any());
    }

    @Test
    void testGetLatestSuccess() {
        String inputEmail = "  TEST@example.com  ";
        String normalizedEmail = "test@example.com";

        when(userService.findByEmailIgnoreCase(normalizedEmail)).thenReturn(Optional.of(mockUser));
        when(userService.findById(1L)).thenReturn(Optional.of(mockUser));

        Prescription mockPrescription = Prescription.builder()
                .id(20L)
                .userId(1L)
                .sphOd(new BigDecimal("-1.50"))
                .sphOs(new BigDecimal("-1.75"))
                .cylOd(new BigDecimal("-0.25"))
                .cylOs(new BigDecimal("-0.50"))
                .axisOd(100)
                .axisOs(95)
                .pd(new BigDecimal("63.00"))
                .build();

        when(prescriptionRepository.findTopByUserIdOrderByIdDesc(1L))
                .thenReturn(Optional.of(mockPrescription));

        PrescriptionResponseDTO response = prescriptionService.getLatest(inputEmail);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(20L);
        assertThat(response.userEmail()).isEqualTo("test@example.com");
        assertThat(response.sphOd()).isEqualTo(new BigDecimal("-1.50"));
        assertThat(response.sphOs()).isEqualTo(new BigDecimal("-1.75"));
        assertThat(response.cylOd()).isEqualTo(new BigDecimal("-0.25"));
        assertThat(response.cylOs()).isEqualTo(new BigDecimal("-0.50"));
        assertThat(response.axisOd()).isEqualTo(100);
        assertThat(response.axisOs()).isEqualTo(95);
        assertThat(response.pd()).isEqualTo(new BigDecimal("63.00"));
    }

    @Test
    void testGetLatestThrowsExceptionWhenUserNotFound() {
        String inputEmail = "unknown@example.com";
        when(userService.findByEmailIgnoreCase("unknown@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> prescriptionService.getLatest(inputEmail))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Authenticated user could not be found.");
    }

    @Test
    void testGetLatestThrowsExceptionWhenNoPrescriptionHistory() {
        String inputEmail = "test@example.com";
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(mockUser));
        when(prescriptionRepository.findTopByUserIdOrderByIdDesc(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> prescriptionService.getLatest(inputEmail))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("No prescription has been saved for this account.");
    }
}
