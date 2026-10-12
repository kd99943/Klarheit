package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.klarheit.backend.product.Product;
import com.klarheit.backend.product.ProductRepository;
import com.klarheit.backend.product.ProductService;
import com.klarheit.backend.product.dto.ProductRequestDTO;
import com.klarheit.backend.product.dto.ProductResponseDTO;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private ProductService productService;

    @Test
    void createProduct_createsAndSavesProduct() {
        ProductRequestDTO request = new ProductRequestDTO(
                "Aero X",
                "飞行家 X",
                "Titanium",
                "钛金属",
                new BigDecimal("500.00"),
                "/images/aero.png",
                "ROUND",
                "50-20-140",
                "/images/detail1.png,/images/detail2.png"
        );

        Product savedProduct = Product.builder()
                .id(1L)
                .nameEn(request.nameEn())
                .nameZh(request.nameZh())
                .materialEn(request.materialEn())
                .materialZh(request.materialZh())
                .basePrice(request.basePrice())
                .imageUrl(request.imageUrl())
                .shape(request.shape())
                .specsSize(request.specsSize())
                .detailImages(request.detailImages())
                .build();

        savedProduct.setName(request.nameEn());
        savedProduct.setMaterial(request.materialEn());

        when(productRepository.save(any(Product.class))).thenReturn(savedProduct);

        ProductResponseDTO response = productService.createProduct(request);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.nameEn()).isEqualTo("Aero X");
        assertThat(response.nameZh()).isEqualTo("飞行家 X");
        assertThat(response.materialEn()).isEqualTo("Titanium");
        assertThat(response.materialZh()).isEqualTo("钛金属");
        assertThat(response.basePrice()).isEqualTo(new BigDecimal("500.00"));
        assertThat(response.imageUrl()).isEqualTo("/images/aero.png");
        assertThat(response.shape()).isEqualTo("ROUND");
        assertThat(response.specsSize()).isEqualTo("50-20-140");
        assertThat(response.detailImages()).isEqualTo("/images/detail1.png,/images/detail2.png");

        verify(productRepository, times(1)).save(any(Product.class));
    }

    @Test
    void updateProduct_updatesProductAndSyncsLegacyFields() {
        Long productId = 1L;
        Product existingProduct = Product.builder()
                .id(productId)
                .nameEn("Old Name En")
                .nameZh("Old Name Zh")
                .materialEn("Old Material En")
                .materialZh("Old Material Zh")
                .basePrice(new BigDecimal("400.00"))
                .imageUrl("/images/old.png")
                .shape("SQUARE")
                .specsSize("50-20-140")
                .detailImages("old_detail")
                .build();
        existingProduct.setName("Old Name En");
        existingProduct.setMaterial("Old Material En");

        ProductRequestDTO request = new ProductRequestDTO(
                "New Name En",
                "New Name Zh",
                "New Material En",
                "New Material Zh",
                new BigDecimal("600.00"),
                "/images/new.png",
                "ROUND",
                "52-18-145",
                "new_detail"
        );

        when(productRepository.findById(productId)).thenReturn(Optional.of(existingProduct));
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProductResponseDTO response = productService.updateProduct(productId, request);

        assertThat(response).isNotNull();
        assertThat(response.nameEn()).isEqualTo("New Name En");
        assertThat(response.nameZh()).isEqualTo("New Name Zh");
        assertThat(response.materialEn()).isEqualTo("New Material En");
        assertThat(response.materialZh()).isEqualTo("New Material Zh");
        assertThat(response.name()).isEqualTo("New Name En");
        assertThat(response.material()).isEqualTo("New Material En");
        assertThat(response.basePrice()).isEqualTo(new BigDecimal("600.00"));
        assertThat(response.imageUrl()).isEqualTo("/images/new.png");
        assertThat(response.shape()).isEqualTo("ROUND");
        assertThat(response.specsSize()).isEqualTo("52-18-145");
        assertThat(response.detailImages()).isEqualTo("new_detail");

        verify(productRepository, times(1)).findById(productId);
        verify(productRepository, times(1)).save(existingProduct);
    }

    @Test
    void updateProduct_throwsIllegalArgumentExceptionWhenNotFound() {
        Long productId = 999L;
        ProductRequestDTO request = new ProductRequestDTO(
                "New Name En",
                "New Name Zh",
                "New Material En",
                "New Material Zh",
                new BigDecimal("600.00"),
                "/images/new.png",
                "ROUND",
                "52-18-145",
                "new_detail"
        );

        when(productRepository.findById(productId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.updateProduct(productId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product not found: " + productId);

        verify(productRepository, times(1)).findById(productId);
    }

    @Test
    void deleteProduct_deletesProductSuccessfully() {
        Long productId = 1L;
        Product existingProduct = Product.builder().id(productId).build();

        when(productRepository.findById(productId)).thenReturn(Optional.of(existingProduct));

        productService.deleteProduct(productId);

        verify(productRepository, times(1)).findById(productId);
        verify(productRepository, times(1)).delete(existingProduct);
    }

    @Test
    void getById_returnsProductWhenFound() {
        Long productId = 1L;
        Product existingProduct = Product.builder()
                .id(productId)
                .nameEn("Aero X")
                .nameZh("飞行家 X")
                .materialEn("Titanium")
                .materialZh("钛金属")
                .basePrice(new BigDecimal("500.00"))
                .imageUrl("/images/aero.png")
                .shape("ROUND")
                .specsSize("50-20-140")
                .build();
        existingProduct.setName("Aero X");
        existingProduct.setMaterial("Titanium");

        when(productRepository.findById(productId)).thenReturn(Optional.of(existingProduct));

        ProductResponseDTO response = productService.getProductById(productId);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(productId);
        assertThat(response.nameEn()).isEqualTo("Aero X");

        verify(productRepository, times(1)).findById(productId);
    }

    @Test
    void getById_throwsEntityNotFoundExceptionWhenNotFound() {
        Long productId = 999L;

        when(productRepository.findById(productId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.getProductById(productId))
                .isInstanceOf(jakarta.persistence.EntityNotFoundException.class)
                .hasMessageContaining("Product not found: " + productId);

        verify(productRepository, times(1)).findById(productId);
    }
}
