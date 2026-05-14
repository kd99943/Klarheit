package com.klarheit.backend.lens;

import com.klarheit.backend.lens.dto.LensOptionResponseDTO;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class LensOptionService {
    private final LensOptionRepository lensOptionRepository;

    public LensOptionService(LensOptionRepository lensOptionRepository) {
        this.lensOptionRepository = lensOptionRepository;
    }

    public List<LensOptionResponseDTO> getOptions() {
        return lensOptionRepository.findAll().stream()
                .map(option -> new LensOptionResponseDTO(
                        option.getId(),
                        option.getType(),
                        categoryFor(option.getType()),
                        labelFor(option.getType()),
                        descriptionFor(option.getType()),
                        option.getIndexValue(),
                        option.getAdditionalPrice()))
                .toList();
    }

    private String categoryFor(String type) {
        return switch (type) {
            case "HIGH_INDEX_174" -> "LENS";
            case "AR_ONYX", "HEV_BLUE" -> "COATING";
            default -> "OPTION";
        };
    }

    private String labelFor(String type) {
        return switch (type) {
            case "HIGH_INDEX_174" -> "Custom Lenses (High-Index)";
            case "AR_ONYX" -> "Onyx AR Coating";
            case "HEV_BLUE" -> "HEV Filter";
            default -> type;
        };
    }

    private String descriptionFor(String type) {
        return switch (type) {
            case "HIGH_INDEX_174" -> "Thin 1.74 index lenses for stronger prescriptions.";
            case "AR_ONYX" -> "Premium anti-reflective coating for glare reduction.";
            case "HEV_BLUE" -> "Blue light filtering treatment for daily screen use.";
            default -> "";
        };
    }
}
