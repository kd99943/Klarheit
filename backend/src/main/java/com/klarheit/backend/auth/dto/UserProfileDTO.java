package com.klarheit.backend.auth.dto;

public record UserProfileDTO(
        Long id,
        String email,
        String firstName,
        String lastName) {
}
