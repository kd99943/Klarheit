package com.klarheit.backend;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableRetry
@EnableScheduling
@EnableCaching
public class KlarheitBackendApplication {
    public static void main(String[] args) {
        Dotenv dotenv = Dotenv.configure()
                .directory(".")
                .ignoreIfMissing()
                .load();
        dotenv.entries().forEach(entry -> {
            System.setProperty(entry.getKey(), entry.getValue());
            // Spring reads the active profile from spring.profiles.active only;
            // a system property named SPRING_PROFILES_ACTIVE is ignored.
            if ("SPRING_PROFILES_ACTIVE".equals(entry.getKey())) {
                System.setProperty("spring.profiles.active", entry.getValue());
            }
        });
        SpringApplication.run(KlarheitBackendApplication.class, args);
    }
}
