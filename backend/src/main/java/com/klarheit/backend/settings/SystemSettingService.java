package com.klarheit.backend.settings;

import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SystemSettingService {
    public static final String KEY_CHECKOUT_ENABLED = "checkout_enabled";
    public static final String KEY_CHECKOUT_PAUSE_REASON = "checkout_pause_reason";

    private final SystemSettingRepository repository;

    public SystemSettingService(SystemSettingRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public boolean isCheckoutEnabled() {
        return repository.findById(KEY_CHECKOUT_ENABLED)
                .map(setting -> !"false".equalsIgnoreCase(setting.getSettingValue()))
                .orElse(true);
    }

    @Transactional(readOnly = true)
    public String getCheckoutPauseReason() {
        return repository.findById(KEY_CHECKOUT_PAUSE_REASON)
                .map(SystemSetting::getSettingValue)
                .orElse("");
    }

    @Transactional
    public void setCheckoutEnabled(boolean enabled, String reason, String updatedBy) {
        LocalDateTime now = LocalDateTime.now();
        repository.save(new SystemSetting(KEY_CHECKOUT_ENABLED, String.valueOf(enabled), updatedBy, now));
        repository.save(new SystemSetting(
                KEY_CHECKOUT_PAUSE_REASON,
                reason == null ? "" : reason.trim(),
                updatedBy,
                now
        ));
    }
}
