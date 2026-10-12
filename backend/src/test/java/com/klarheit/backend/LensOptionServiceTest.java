package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.klarheit.backend.lens.LensOption;
import com.klarheit.backend.lens.LensOptionRepository;
import com.klarheit.backend.lens.LensOptionService;
import com.klarheit.backend.lens.dto.LensOptionResponseDTO;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LensOptionServiceTest {

    @Mock
    private LensOptionRepository lensOptionRepository;

    @InjectMocks
    private LensOptionService lensOptionService;

    @Test
    void testGetOptionsMapsPropertiesCorrectly() {
        LensOption option1 = LensOption.builder()
                .id(1L)
                .type("typeA")
                .category("categoryA")
                .label("labelA")
                .description("descA")
                .indexValue(new BigDecimal("1.56"))
                .additionalPrice(new BigDecimal("10.00"))
                .build();

        LensOption option2 = LensOption.builder()
                .id(2L)
                .type("typeB")
                .category("categoryB")
                .label("labelB")
                .description("descB")
                .indexValue(new BigDecimal("1.60"))
                .additionalPrice(new BigDecimal("20.00"))
                .build();

        when(lensOptionRepository.findAll()).thenReturn(List.of(option1, option2));

        List<LensOptionResponseDTO> results = lensOptionService.getOptions();

        assertThat(results).hasSize(2);
        
        LensOptionResponseDTO dto1 = results.get(0);
        assertThat(dto1.id()).isEqualTo(1L);
        assertThat(dto1.type()).isEqualTo("typeA");
        assertThat(dto1.category()).isEqualTo("categoryA");
        assertThat(dto1.label()).isEqualTo("labelA");
        assertThat(dto1.description()).isEqualTo("descA");
        assertThat(dto1.indexValue()).isEqualTo(new BigDecimal("1.56"));
        assertThat(dto1.additionalPrice()).isEqualTo(new BigDecimal("10.00"));

        LensOptionResponseDTO dto2 = results.get(1);
        assertThat(dto2.id()).isEqualTo(2L);
        assertThat(dto2.type()).isEqualTo("typeB");
        assertThat(dto2.category()).isEqualTo("categoryB");
        assertThat(dto2.label()).isEqualTo("labelB");
        assertThat(dto2.description()).isEqualTo("descB");
        assertThat(dto2.indexValue()).isEqualTo(new BigDecimal("1.60"));
        assertThat(dto2.additionalPrice()).isEqualTo(new BigDecimal("20.00"));
    }
}
