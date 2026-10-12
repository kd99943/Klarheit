package com.klarheit.backend.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Expiry;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CacheConfig {

    /**
     * Builds an Expiry that adds a small random jitter to the TTL of each entry.
     * This prevents cache avalanches: when many entries are written at once
     * (e.g. on cold start), they won't all expire at the same instant and
     * stampede the database.
     */
    private Expiry<Object, Object> withJitter(long baseMinutes, long jitterMinutes) {
        return new Expiry<>() {
            @Override
            public long expireAfterCreate(Object key, Object value, long currentTime) {
                long jitter = ThreadLocalRandom.current().nextLong(0, jitterMinutes + 1);
                return TimeUnit.MINUTES.toNanos(baseMinutes + jitter);
            }

            @Override
            public long expireAfterUpdate(Object key, Object value, long currentTime, long currentDuration) {
                return currentDuration;
            }

            @Override
            public long expireAfterRead(Object key, Object value, long currentTime, long currentDuration) {
                return currentDuration;
            }
        };
    }

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();

        // productCatalog: 10 min base TTL + 0-2 min jitter (avoids synchronized expiry / cache avalanche)
        cacheManager.registerCustomCache("productCatalog",
                Caffeine.newBuilder()
                        .expireAfter(withJitter(10, 2))
                        .maximumSize(100)
                        .build());

        // lensOptions: 30 min base TTL + 0-5 min jitter
        cacheManager.registerCustomCache("lensOptions",
                Caffeine.newBuilder()
                        .expireAfter(withJitter(30, 5))
                        .maximumSize(50)
                        .build());

        return cacheManager;
    }
}
