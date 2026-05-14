package com.klarheit.backend.lens;

import com.klarheit.backend.lens.dto.LensOptionResponseDTO;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/lens-options")
public class LensOptionController {
    private final LensOptionService lensOptionService;

    public LensOptionController(LensOptionService lensOptionService) {
        this.lensOptionService = lensOptionService;
    }

    @GetMapping
    public ResponseEntity<List<LensOptionResponseDTO>> getLensOptions() {
        return ResponseEntity.ok(lensOptionService.getOptions());
    }
}
