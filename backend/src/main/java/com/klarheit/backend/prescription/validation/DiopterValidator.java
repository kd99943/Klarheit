package com.klarheit.backend.prescription.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.math.BigDecimal;

public class DiopterValidator implements ConstraintValidator<ValidDiopter, BigDecimal> {
    @Override
    public boolean isValid(BigDecimal value, ConstraintValidatorContext context) {
        if (value == null) {
            return true; // Let @NotNull handle nulls if required
        }
        // Validate that the value is in 0.25 steps
        BigDecimal step = new BigDecimal("0.25");
        BigDecimal remainder = value.remainder(step);
        return remainder.compareTo(BigDecimal.ZERO) == 0;
    }
}
