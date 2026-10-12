package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;

import com.klarheit.backend.config.CacheConfig;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;

class CacheConfigTest {

    @Test
    void cacheManagerIsConfiguredWithExpectedCaches() {
        CacheConfig cacheConfig = new CacheConfig();
        CacheManager cacheManager = cacheConfig.cacheManager();

        assertThat(cacheManager).isNotNull();

        Cache productCatalogCache = cacheManager.getCache("productCatalog");
        assertThat(productCatalogCache).isNotNull();

        Cache lensOptionsCache = cacheManager.getCache("lensOptions");
        assertThat(lensOptionsCache).isNotNull();
    }
}
