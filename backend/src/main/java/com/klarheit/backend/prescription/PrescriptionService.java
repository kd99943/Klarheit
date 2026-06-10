package com.klarheit.backend.prescription;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserService;
import com.klarheit.backend.prescription.dto.PrescriptionPayloadDTO;
import com.klarheit.backend.prescription.dto.PrescriptionResponseDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class PrescriptionService {
    private final PrescriptionRepository prescriptionRepository;
    private final UserService userService;

    public PrescriptionService(PrescriptionRepository prescriptionRepository, UserService userService) {
        this.prescriptionRepository = prescriptionRepository;
        this.userService = userService;
    }

    public PrescriptionResponseDTO save(String email, PrescriptionPayloadDTO payload) {
        UserAccount user = userService.findByEmailIgnoreCase(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));

        Prescription saved = prescriptionRepository.save(Prescription.builder()
                .sphOd(payload.sphOd())
                .sphOs(payload.sphOs())
                .cylOd(payload.cylOd())
                .cylOs(payload.cylOs())
                .axisOd(payload.axisOd())
                .axisOs(payload.axisOs())
                .pd(payload.pd())
                .userId(user.getId())
                .build());

        log.info("Prescription saved for user: {}", user.getEmail());
        return toResponse(saved);
    }

    public PrescriptionResponseDTO getLatest(String email) {
        UserAccount user = userService.findByEmailIgnoreCase(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user could not be found."));
        Prescription prescription = prescriptionRepository.findTopByUserIdOrderByIdDesc(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("No prescription has been saved for this account."));
        return toResponse(prescription);
    }

    private PrescriptionResponseDTO toResponse(Prescription prescription) {
        String email = userService.findById(prescription.getUserId())
                .map(UserAccount::getEmail)
                .orElse(null);
        return new PrescriptionResponseDTO(
                prescription.getId(),
                email,
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
