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
                        option.getCategory(),
                        option.getLabel(),
                        option.getDescription(),
                        option.getIndexValue(),
                        option.getAdditionalPrice()))
                .toList();
    }
}
