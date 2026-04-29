package com.klarheit.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderControllerIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    @WithMockUser(username = "ada@example.com")
    void checkoutCreatesOrder() throws Exception {
        ensureUserExists();

        String payload = """
                {
                  "productId": 1,
                  "lensOptionTypes": ["HIGH_INDEX_174", "AR_ONYX", "HEV_BLUE"],
                  "customer": {
                    "firstName": "Ada",
                    "lastName": "Lovelace",
                    "email": "ada@example.com",
                    "shippingAddress": "1 Analytical Engine Way"
                  },
                  "prescription": {
                    "sphOd": -2.25,
                    "sphOs": -2.00,
                    "cylOd": -0.50,
                    "cylOs": -0.25,
                    "axisOd": 180,
                    "axisOs": 175,
                    "pd": 63.50
                  }
                }
                """;

        mockMvc.perform(post("/api/v1/orders/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.productName").value("AERO X1"))
                .andExpect(jsonPath("$.totalAmount").value(1155.00));
    }

    @Test
    @WithMockUser(username = "ada@example.com")
    void checkoutRejectsInvalidPayload() throws Exception {
        ensureUserExists();

        String payload = """
                {
                  "productId": null,
                  "lensOptionTypes": [],
                  "customer": {
                    "firstName": "",
                    "lastName": "",
                    "email": "broken",
                    "shippingAddress": ""
                  },
                  "prescription": {
                    "sphOd": -2.25,
                    "sphOs": -2.00,
                    "cylOd": -0.50,
                    "cylOs": -0.25,
                    "axisOd": 181,
                    "axisOs": 175,
                    "pd": 63.50
                  }
                }
                """;

        mockMvc.perform(post("/api/v1/orders/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed."));
    }

    @Test
    void checkoutRequiresAuthentication() throws Exception {
        String payload = """
                {
                  "productId": 1,
                  "lensOptionTypes": ["HIGH_INDEX_174"],
                  "customer": {
                    "firstName": "Ada",
                    "lastName": "Lovelace",
                    "email": "ada@example.com",
                    "shippingAddress": "1 Analytical Engine Way"
                  },
                  "prescription": {
                    "sphOd": -2.25,
                    "sphOs": -2.00,
                    "cylOd": -0.50,
                    "cylOs": -0.25,
                    "axisOd": 180,
                    "axisOs": 175,
                    "pd": 63.50
                  }
                }
                """;

        mockMvc.perform(post("/api/v1/orders/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isUnauthorized());
    }

    private void ensureUserExists() {
        if (!userAccountRepository.existsByEmailIgnoreCase("ada@example.com")) {
            userAccountRepository.save(UserAccount.builder()
                    .email("ada@example.com")
                    .passwordHash(passwordEncoder.encode("precision123"))
                    .firstName("Ada")
                    .lastName("Lovelace")
                    .build());
        }
    }
}
