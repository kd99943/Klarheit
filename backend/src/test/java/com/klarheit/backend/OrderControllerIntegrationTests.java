package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderControllerIntegrationTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrderRepository orderRepository;

    @Test
    void checkoutCreatesOrderAndPersistsDetails() throws Exception {
        String token = TestAuthSupport.registerAndExtractToken(mockMvc, "checkout@example.com");

        MvcResult result = mockMvc.perform(post("/api/v1/orders/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "productId": 1,
                                  "lensOptionTypes": ["HIGH_INDEX_174", "AR_ONYX", "HEV_BLUE"],
                                  "customer": {
                                    "firstName": "Mina",
                                    "lastName": "Hart",
                                    "email": "checkout@example.com",
                                    "shippingAddress": "1 Vision Plaza"
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
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.productName").isString())
                .andExpect(jsonPath("$.lensOptionTypes[0]").value("HIGH_INDEX_174"))
                .andReturn();

        String orderNumber = TestAuthSupport.readJson(result).get("orderNumber").asText();
        Order order = orderRepository.findByOrderNumber(orderNumber).orElseThrow();

        assertThat(order.getCustomerEmail()).isEqualTo("checkout@example.com");
        assertThat(order.getShippingAddress()).isEqualTo("1 Vision Plaza");
        assertThat(order.getLensOptionTypes()).isEqualTo("HIGH_INDEX_174,AR_ONYX,HEV_BLUE");
        assertThat(order.getPrescription()).isNotNull();
        assertThat(order.getProduct()).isNotNull();
    }

    @Test
    void checkoutRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/orders/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "productId": 1,
                                  "lensOptionTypes": ["HIGH_INDEX_174"],
                                  "customer": {
                                    "firstName": "Mina",
                                    "lastName": "Hart",
                                    "email": "checkout@example.com",
                                    "shippingAddress": "1 Vision Plaza"
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
                                """))
                .andExpect(status().isUnauthorized());
    }
}
