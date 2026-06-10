package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
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
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerIntegrationTests {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void registerLoginAndMeFlowWorks() throws Exception {
        MvcResult registerResult = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": "Ava",
                                  "lastName": "Stone",
                                  "email": "ava@example.com",
                                  "password": "Password123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("ava@example.com"))
                .andReturn();

        jakarta.servlet.http.Cookie registerCookie = registerResult.getResponse().getCookie("klarheit_auth_token");
        assertThat(registerCookie).isNotNull();
        assertThat(registerCookie.isHttpOnly()).isTrue();

        mockMvc.perform(get("/api/v1/auth/me")
                        .cookie(registerCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Ava"))
                .andExpect(jsonPath("$.lastName").value("Stone"));

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "ava@example.com",
                                  "password": "Password123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.user.email").value("ava@example.com"))
                .andReturn();

        jakarta.servlet.http.Cookie loginCookie = loginResult.getResponse().getCookie("klarheit_auth_token");
        assertThat(loginCookie).isNotNull();

        MvcResult logoutResult = mockMvc.perform(post("/api/v1/auth/logout"))
                .andExpect(status().isOk())
                .andReturn();

        jakarta.servlet.http.Cookie clearedCookie = logoutResult.getResponse().getCookie("klarheit_auth_token");
        assertThat(clearedCookie).isNotNull();
        assertThat(clearedCookie.getMaxAge()).isEqualTo(0);
    }
}
