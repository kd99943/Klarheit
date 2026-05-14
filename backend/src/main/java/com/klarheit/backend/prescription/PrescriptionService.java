package com.klarheit.backend.prescription;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import com.klarheit.backend.prescription.dto.PrescriptionPayloadDTO;
import com.klarheit.backend.prescription.dto.PrescriptionResponseDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class PrescriptionService {
    private final PrescriptionRepository prescriptionRepository;
    private final UserAccountRepository userAccountRepository;

    public PrescriptionService(PrescriptionRepository prescriptionRepository, UserAccountRepository userAccountRepository) {
        this.prescriptionRepository = prescriptionRepository;
        this.userAccountRepository = userAccountRepository;
    }

    public PrescriptionResponseDTO save(String email, PrescriptionPayloadDTO payload) {
        UserAccount user = userAccountRepository.findByEmailIgnoreCase(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));

        Prescription saved = prescriptionRepository.save(Prescription.builder()
                .userEmail(user.getEmail())
                .sphOd(payload.sphOd())
                .sphOs(payload.sphOs())
                .cylOd(payload.cylOd())
                .cylOs(payload.cylOs())
                .axisOd(payload.axisOd())
                .axisOs(payload.axisOs())
                .pd(payload.pd())
                .user(user)
                .build());

        log.info("Prescription saved for user: {}", user.getEmail());
        return toResponse(saved);
    }

    public PrescriptionResponseDTO getLatest(String email) {
        Prescription prescription = prescriptionRepository.findTopByUserEmailOrderByIdDesc(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("No prescription has been saved for this account."));
        return toResponse(prescription);
    }

    private PrescriptionResponseDTO toResponse(Prescription prescription) {
        return new PrescriptionResponseDTO(
                prescription.getId(),
                prescription.getUserEmail(),
                prescription.getSphOd(),
                prescription.getSphOs(),
                prescription.getCylOd(),
                prescription.getCylOs(),
                prescription.getAxisOd(),
                prescription.getAxisOs(),
                prescription.getPd());
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
