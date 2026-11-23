package com.klarheit.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequestDTO(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 8, max = 128) String newPassword
) {}
