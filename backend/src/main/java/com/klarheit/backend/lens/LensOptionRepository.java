package com.klarheit.backend.lens;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LensOptionRepository extends JpaRepository<LensOption, Long> {

    List<LensOption> findByTypeIn(List<String> types);
}
