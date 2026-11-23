package com.klarheit.backend.settings;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/system")
public class SystemStatusController {
    private final SystemSettingService systemSettingService;

    public SystemStatusController(SystemSettingService systemSettingService) {
        this.systemSettingService = systemSettingService;
    }

    @GetMapping("/checkout-status")
    public ResponseEntity<Map<String, Object>> getCheckoutStatus() {
        boolean enabled = systemSettingService.isCheckoutEnabled();
        String pauseReason = systemSettingService.getCheckoutPauseReason();
        return ResponseEntity.ok(Map.of(
                "checkoutEnabled", enabled,
                "pauseReason", pauseReason
        ));
    }
}
