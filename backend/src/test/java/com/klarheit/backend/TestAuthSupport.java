package com.klarheit.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

final class TestAuthSupport {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private TestAuthSupport() {}

    static String registerAndExtractToken(MockMvc mockMvc, String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": "Test",
                                  "lastName": "User",
                                  "email": "%s",
                                  "password": "Password123"
                                }
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        jakarta.servlet.http.Cookie cookie = result.getResponse().getCookie("klarheit_auth_token");
        return cookie != null ? cookie.getValue() : null;
    }

    static JsonNode readJson(MvcResult result) throws Exception {
        return OBJECT_MAPPER.readTree(result.getResponse().getContentAsString());
    }
}
