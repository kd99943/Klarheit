package com.klarheit.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductAndLensControllerIntegrationTests {
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
