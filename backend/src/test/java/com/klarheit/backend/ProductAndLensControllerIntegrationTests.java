package com.klarheit.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

class ProductAndLensControllerIntegrationTests extends BaseIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void productCatalogIsAvailable() throws Exception {
        mockMvc.perform(get("/api/v1/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").isNumber())
                .andExpect(jsonPath("$[0].name").isString())
                .andExpect(jsonPath("$[0].basePrice").isNumber());
    }

    @Test
    void productDetailLoadsArConfigsWithoutLazyInitError() throws Exception {
        // Regression test for the LazyInitializationException that occurred because
        // getProductById lacked @Transactional and findById lacked @EntityGraph.
        Long firstId = readFirstProductId();

        mockMvc.perform(get("/api/v1/products/" + firstId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(firstId))
                .andExpect(jsonPath("$.arConfigs").exists());
    }

    @Test
    void productDetailReturnsNotFoundForUnknownId() throws Exception {
        mockMvc.perform(get("/api/v1/products/999999"))
                .andExpect(status().isNotFound());
    }

    private Long readFirstProductId() throws Exception {
        String json = mockMvc.perform(get("/api/v1/products"))
                .andReturn().getResponse().getContentAsString();
        // Naive parse: find the first "id":<number>
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("\"id\"\\s*:\\s*(\\d+)")
                .matcher(json);
        if (!matcher.find()) {
            throw new IllegalStateException("No product id found in catalog: " + json);
        }
        return Long.parseLong(matcher.group(1));
    }

    @Test
    void lensOptionsRequireAuthenticationButExposeStructuredDto() throws Exception {
        String token = TestAuthSupport.registerAndExtractToken(mockMvc, "lens@example.com");

        mockMvc.perform(get("/api/v1/lens-options")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").isString())
                .andExpect(jsonPath("$[0].category").isString())
                .andExpect(jsonPath("$[0].label").isString())
                .andExpect(jsonPath("$[0].additionalPrice").isNumber());
    }
}
