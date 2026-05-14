package com.klarheit.backend.prescription;

import com.klarheit.backend.prescription.dto.PrescriptionPayloadDTO;
import com.klarheit.backend.prescription.dto.PrescriptionResponseDTO;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/prescriptions")
public class PrescriptionController {
    private final PrescriptionService prescriptionService;

    public PrescriptionController(PrescriptionService prescriptionService) {
        this.prescriptionService = prescriptionService;
    }

    @PostMapping
    public ResponseEntity<PrescriptionResponseDTO> save(@Valid @RequestBody PrescriptionPayloadDTO payload, Authentication authentication) {
        return ResponseEntity.ok(prescriptionService.save(authentication.getName(), payload));
    }

    @GetMapping("/me/latest")
    public ResponseEntity<PrescriptionResponseDTO> latest(Authentication authentication) {
        return ResponseEntity.ok(prescriptionService.getLatest(authentication.getName()));
    }
}
