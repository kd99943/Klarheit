package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.klarheit.backend.prescription.validation.DiopterValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DiopterValidatorTest {

    private DiopterValidator validator;
    private ConstraintValidatorContext context;

    @BeforeEach
    void setUp() {
        validator = new DiopterValidator();
        context = mock(ConstraintValidatorContext.class);
    }

    @Test
    void testNullValueReturnsTrue() {
        boolean result = validator.isValid(null, context);
        assertThat(result).isTrue();
    }

    @Test
    void testValidDiopterStepsReturnTrue() {
        assertThat(validator.isValid(new BigDecimal("-2.25"), context)).isTrue();
        assertThat(validator.isValid(new BigDecimal("1.50"), context)).isTrue();
        assertThat(validator.isValid(new BigDecimal("0.00"), context)).isTrue();
        assertThat(validator.isValid(new BigDecimal("-0.25"), context)).isTrue();
        assertThat(validator.isValid(new BigDecimal("3.00"), context)).isTrue();
    }

    @Test
    void testInvalidDiopterStepsReturnFalse() {
        assertThat(validator.isValid(new BigDecimal("-2.13"), context)).isFalse();
        assertThat(validator.isValid(new BigDecimal("1.10"), context)).isFalse();
        assertThat(validator.isValid(new BigDecimal("0.01"), context)).isFalse();
        assertThat(validator.isValid(new BigDecimal("-0.24"), context)).isFalse();
    }
}
