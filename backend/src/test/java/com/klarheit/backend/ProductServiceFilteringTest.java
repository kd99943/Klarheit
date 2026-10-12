package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductRepository;
import com.klarheit.backend.product.ProductService;
import com.klarheit.backend.product.dto.ProductResponseDTO;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProductServiceFilteringTest {

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private ProductService productService;

    private List<Product> mockCatalog;

    @BeforeEach
    void setUp() {
        Product p1 = Product.builder()
                .id(1L)
                .nameEn("AERO X1")
                .nameZh("AERO X1")
                .materialEn("Grade 5 Titanium")
                .materialZh("5级钛金属")
                .basePrice(new BigDecimal("850.00"))
                .imageUrl("/images/aero_x1.png")
                .shape("RECTANGLE")
                .specsSize("54-17-140")
                .build();

        Product p2 = Product.builder()
                .id(2L)
                .nameEn("MONOLITH 02")
                .nameZh("MONOLITH 02")
                .materialEn("Japanese Acetate")
                .materialZh("日本板材")
                .basePrice(new BigDecimal("620.00"))
                .imageUrl("/images/monolith_02.png")
                .shape("SQUARE")
                .specsSize("50-20-145")
                .build();

        Product p3 = Product.builder()
                .id(3L)
                .nameEn("LUCENT V1")
                .nameZh("LUCENT V1")
                .materialEn("Crystal Acetate")
                .materialZh("水晶板材")
                .basePrice(new BigDecimal("580.00"))
                .imageUrl("/images/lucent_v1.png")
                .shape("ROUND")
                .specsSize("49-19-142")
                .build();

        mockCatalog = List.of(p1, p2, p3);
    }

    @Test
    void filterBySearchTerm() {
        when(productRepository.findAll()).thenReturn(mockCatalog);

        List<ProductResponseDTO> result = productService.getCatalogFiltered("aero", null, null, null, null, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).nameEn()).isEqualTo("AERO X1");
    }

    @Test
    void filterByShape() {
        when(productRepository.findAll()).thenReturn(mockCatalog);

        List<ProductResponseDTO> result = productService.getCatalogFiltered(null, null, "ROUND", null, null, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).nameEn()).isEqualTo("LUCENT V1");
    }

    @Test
    void filterByMaterial() {
        when(productRepository.findAll()).thenReturn(mockCatalog);

        // Filter using English material label
        List<ProductResponseDTO> resultEn = productService.getCatalogFiltered(null, "Japanese Acetate", null, null, null, null);
        assertThat(resultEn).hasSize(1);
        assertThat(resultEn.get(0).nameEn()).isEqualTo("MONOLITH 02");

        // Filter using Chinese material label
        List<ProductResponseDTO> resultZh = productService.getCatalogFiltered(null, "日本板材", null, null, null, null);
        assertThat(resultZh).hasSize(1);
        assertThat(resultZh.get(0).nameEn()).isEqualTo("MONOLITH 02");
    }

    @Test
    void filterByPriceRange() {
        when(productRepository.findAll()).thenReturn(mockCatalog);

        List<ProductResponseDTO> result = productService.getCatalogFiltered(null, null, null, new BigDecimal("600.00"), new BigDecimal("800.00"), null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).nameEn()).isEqualTo("MONOLITH 02");
    }

    @Test
    void sortByPriceAscending() {
        when(productRepository.findAll()).thenReturn(mockCatalog);

        List<ProductResponseDTO> result = productService.getCatalogFiltered(null, null, null, null, null, "price_asc");

        assertThat(result).hasSize(3);
        assertThat(result.get(0).nameEn()).isEqualTo("LUCENT V1"); // 580
        assertThat(result.get(1).nameEn()).isEqualTo("MONOLITH 02"); // 620
        assertThat(result.get(2).nameEn()).isEqualTo("AERO X1"); // 850
    }

    @Test
    void sortByPriceDescending() {
        when(productRepository.findAll()).thenReturn(mockCatalog);

        List<ProductResponseDTO> result = productService.getCatalogFiltered(null, null, null, null, null, "price_desc");

        assertThat(result).hasSize(3);
        assertThat(result.get(0).nameEn()).isEqualTo("AERO X1"); // 850
        assertThat(result.get(1).nameEn()).isEqualTo("MONOLITH 02"); // 620
        assertThat(result.get(2).nameEn()).isEqualTo("LUCENT V1"); // 580
    }
}
