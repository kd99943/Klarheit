package com.klarheit.backend.security;

import com.klarheit.backend.config.RateLimitFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final UserAccountDetailsService userAccountDetailsService;
    private final RestAuthenticationEntryPoint restAuthenticationEntryPoint;
    private final RateLimitFilter rateLimitFilter;

    @Autowired(required = false)
    private Environment environment;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          UserAccountDetailsService userAccountDetailsService,
                          RestAuthenticationEntryPoint restAuthenticationEntryPoint,
                          RateLimitFilter rateLimitFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.userAccountDetailsService = userAccountDetailsService;
        this.restAuthenticationEntryPoint = restAuthenticationEntryPoint;
        this.rateLimitFilter = rateLimitFilter;
    }

    private boolean isMockPaymentAllowed() {
        if (environment == null) {
            return false;
        }
        return environment.acceptsProfiles(Profiles.of("local & !prod", "test & !prod"))
                && !"false".equalsIgnoreCase(environment.getProperty("app.payment.mock-enabled", "true"));
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        boolean allowMockPayment = isMockPaymentAllowed();
        http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(restAuthenticationEntryPoint))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                    if (allowMockPayment) {
                        auth.requestMatchers(
                                "/api/v1/payments/callback/mock-trigger",
                                "/api/v1/payments/callback/mock-terminal"
                        ).permitAll();
                    } else {
                        auth.requestMatchers(
                                "/api/v1/payments/callback/mock-trigger",
                                "/api/v1/payments/callback/mock-terminal"
                        ).denyAll();
                    }

                    auth.requestMatchers("/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/logout", "/api/v1/auth/forgot-password").permitAll()
                            .requestMatchers(
                                    "/api/v1/products/**",
                                    "/api/v1/lens-options/**",
                                    "/api/v1/system/checkout-status",
                                    "/api/v1/orders/delivery-estimate",
                                    "/error",
                                    "/actuator/health",
                                    "/actuator/health/**",
                                    "/api/v1/payments/callback/alipay",
                                    "/api/v1/payments/callback/wechat",
                                    "/api/v1/orders/*/status",
                                    "/api/v1/phone/send-code"
                            ).permitAll();

                    if (environment != null && environment.acceptsProfiles(Profiles.of("local & !prod", "test & !prod"))) {
                        auth.requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll();
                    } else {
                        auth.requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").hasRole(StaffRoles.ADMIN);
                    }

                    // P0-10 & Sec 6 P1: Least-privilege functional RBAC boundaries for back-office operations
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/admin/alerts")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.CUSTOMER_SERVICE, StaffRoles.OPTICIAN, StaffRoles.WAREHOUSE, StaffRoles.FINANCE)
                            .requestMatchers(HttpMethod.GET, "/api/v1/admin/notifications")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.CUSTOMER_SERVICE)
                            .requestMatchers(HttpMethod.POST, "/api/v1/admin/notifications/*/resend")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.CUSTOMER_SERVICE)
                            .requestMatchers(HttpMethod.GET, "/api/v1/admin/orders", "/api/v1/admin/orders/*")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.CUSTOMER_SERVICE, StaffRoles.OPTICIAN, StaffRoles.WAREHOUSE, StaffRoles.FINANCE)
                            .requestMatchers(HttpMethod.POST,
                                    "/api/v1/admin/orders/*/quote-confirm",
                                    "/api/v1/admin/orders/*/verify-optician",
                                    "/api/v1/admin/orders/*/start-production")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.OPTICIAN)
                            .requestMatchers(HttpMethod.PUT, "/api/v1/admin/orders/*/prescription")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.OPTICIAN)
                            .requestMatchers(HttpMethod.POST, "/api/v1/admin/orders/*/fulfillment")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.OPTICIAN, StaffRoles.WAREHOUSE)
                            .requestMatchers(HttpMethod.POST,
                                    "/api/v1/admin/orders/*/qc",
                                    "/api/v1/admin/orders/*/ship",
                                    "/api/v1/admin/orders/*/deliver")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.WAREHOUSE)
                            .requestMatchers(HttpMethod.PUT, "/api/v1/admin/orders/*/tracking")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.WAREHOUSE)
                            .requestMatchers(HttpMethod.PUT, "/api/v1/admin/orders/*/shipping-address")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.CUSTOMER_SERVICE)
                            .requestMatchers(HttpMethod.POST, "/api/v1/admin/orders/*/cancel")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.CUSTOMER_SERVICE)
                            .requestMatchers(HttpMethod.GET, "/api/v1/admin/after-sales")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.CUSTOMER_SERVICE, StaffRoles.WAREHOUSE, StaffRoles.FINANCE)
                            .requestMatchers(HttpMethod.PUT, "/api/v1/admin/after-sales/*")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.CUSTOMER_SERVICE, StaffRoles.WAREHOUSE)
                            .requestMatchers(HttpMethod.POST, "/api/v1/admin/after-sales/*/restock")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.WAREHOUSE)
                            .requestMatchers(HttpMethod.POST,
                                    "/api/v1/admin/after-sales/*/refund",
                                    "/api/v1/admin/after-sales/*/finance-verify",
                                    "/api/v1/admin/refunds/*/retry",
                                    "/api/v1/admin/refunds/*/manual-confirm")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.FINANCE)
                            .requestMatchers(HttpMethod.GET, "/api/v1/admin/stats", "/api/v1/admin/reconciliation/export")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.FINANCE)
                            .requestMatchers(HttpMethod.PUT, "/api/v1/admin/orders/*/economics")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.FINANCE)
                            .requestMatchers(HttpMethod.GET, "/api/v1/admin/products", "/api/v1/admin/products/*/skus")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.WAREHOUSE, StaffRoles.OPTICIAN, StaffRoles.FINANCE)
                            .requestMatchers(HttpMethod.PUT, "/api/v1/admin/products/*/skus")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.WAREHOUSE)
                            .requestMatchers(HttpMethod.POST, "/api/v1/admin/inventory/stocktake-import")
                                    .hasAnyRole(StaffRoles.ADMIN, StaffRoles.WAREHOUSE)
                            .requestMatchers("/api/v1/admin/**").hasRole(StaffRoles.ADMIN)
                            .anyRequest().authenticated();
                })
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userAccountDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
