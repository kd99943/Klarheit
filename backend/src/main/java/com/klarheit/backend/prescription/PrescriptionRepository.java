package com.klarheit.backend.prescription;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PrescriptionRepository extends JpaRepository<Prescription, Long> {
    Optional<Prescription> findTopByUserEmailOrderByIdDesc(String userEmail);
}
