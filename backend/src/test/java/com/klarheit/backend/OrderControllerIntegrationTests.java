package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class OrderControllerIntegrationTests extends BaseIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private com.klarheit.backend.product.ProductSkuRepository productSkuRepository;

    @Test
    void checkoutCreatesOrderAndPersistsDetails() throws Exception {
        // Ensure a physically stocktaken, sellable SKU exists for product 1 in this test tx (P0-02)
        var skus = productSkuRepository.findByProductIdOrderByIdAsc(1L);
        String chosenFinish = "titanium";
        String chosenSize = "54-17-140";
        if (!skus.isEmpty()) {
            var first = skus.get(0);
            first.setOnHandQty(10);
            first.setCommittedQty(0);
            first.setSalesStatus(com.klarheit.backend.product.ProductSalesStatus.AVAILABLE);
            first.setStocktakeVerified(true);
            productSkuRepository.save(first);
            chosenFinish = first.getFinishId();
            chosenSize = first.getSizeSpec();
        }

        String token = TestAuthSupport.registerAndExtractToken(mockMvc, "checkout@example.com");

        MvcResult result = mockMvc.perform(post("/api/v1/orders/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "productId": 1,
                                  "finishId": "%s",
                                  "sizeSpec": "%s",
                                  "lensOptionTypes": ["HIGH_INDEX_174", "AR_ONYX", "HEV_BLUE"],
                                  "customer": {
                                    "firstName": "Mina",
                                    "lastName": "Hart",
                                    "email": "checkout@example.com",
                                    "phone": "13800138000",
                                    "province": "上海市",
                                    "city": "上海市",
                                    "district": "静安区",
                                    "detailAddress": "南京西路1号视界广场",
                                    "shippingAddress": "上海市 上海市 静安区 南京西路1号视界广场"
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
                                """.formatted(chosenFinish, chosenSize)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.productName").isString())
                .andExpect(jsonPath("$.lensOptionTypes[0]").value("HIGH_INDEX_174"))
                .andReturn();

        String orderNumber = TestAuthSupport.readJson(result).get("orderNumber").asText();
        Order order = orderRepository.findByOrderNumber(orderNumber).orElseThrow();

        assertThat(order.getCustomerEmail()).isEqualTo("checkout@example.com");
        assertThat(order.getShippingAddress()).contains("南京西路1号视界广场");
        assertThat(order.getLensOptionTypes()).containsExactly("HIGH_INDEX_174", "AR_ONYX", "HEV_BLUE");
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

    @Test
    void checkoutRejectsInvalidDiopter() throws Exception {
        String token = TestAuthSupport.registerAndExtractToken(mockMvc, "checkout_invalid@example.com");

        mockMvc.perform(post("/api/v1/orders/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "productId": 1,
                                  "lensOptionTypes": ["HIGH_INDEX_174"],
                                  "customer": {
                                    "firstName": "Mina",
                                    "lastName": "Hart",
                                    "email": "checkout_invalid@example.com",
                                    "shippingAddress": "1 Vision Plaza"
                                  },
                                  "prescription": {
                                    "sphOd": -2.13,
                                    "sphOs": -2.00,
                                    "cylOd": -0.50,
                                    "cylOs": -0.25,
                                    "axisOd": 180,
                                    "axisOs": 175,
                                    "pd": 63.50
                                  }
                                }
                                """))
                .andExpect(status().isBadRequest());
    }
}
