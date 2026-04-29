package com.klarheit.backend.auth.dto;

public record AuthResponseDTO(
        String token,
        UserProfileDTO user) {
}
