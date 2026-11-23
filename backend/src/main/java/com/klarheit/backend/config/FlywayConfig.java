package com.klarheit.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayConfig {

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy(
            @Value("${spring.flyway.repair-on-migrate:false}") boolean repairOnMigrate) {
        return flyway -> {
            if (repairOnMigrate) {
                flyway.repair();
            }
            flyway.migrate();
        };
    }
}
