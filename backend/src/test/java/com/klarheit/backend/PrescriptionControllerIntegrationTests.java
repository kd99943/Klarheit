package com.klarheit.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PrescriptionControllerIntegrationTests {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void prescriptionCanBeSavedAndFetched() throws Exception {
        String token = TestAuthSupport.registerAndExtractToken(mockMvc, "rx@example.com");

        mockMvc.perform(post("/api/v1/prescriptions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sphOd": -2.25,
                                  "sphOs": -2.00,
                                  "cylOd": -0.50,
                                  "cylOs": -0.25,
                                  "axisOd": 180,
                                  "axisOs": 175,
                                  "pd": 63.50
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userEmail").value("rx@example.com"));

        mockMvc.perform(get("/api/v1/prescriptions/me/latest")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sphOd").value(-2.25))
                .andExpect(jsonPath("$.axisOs").value(175));
    }

    @Test
    void prescriptionRejectsInvalidDiopter() throws Exception {
        String token = TestAuthSupport.registerAndExtractToken(mockMvc, "rx_invalid@example.com");

        mockMvc.perform(post("/api/v1/prescriptions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sphOd": -2.13,
                                  "sphOs": -2.00,
                                  "cylOd": -0.50,
                                  "cylOs": -0.25,
                                  "axisOd": 180,
                                  "axisOs": 175,
                                  "pd": 63.50
                                }
                                """))
                .andExpect(status().isBadRequest());
    }
}
