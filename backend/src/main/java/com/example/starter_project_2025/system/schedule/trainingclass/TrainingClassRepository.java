package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface TrainingClassRepository
        extends BaseCrudRepository<TrainingClass, Long> {

    boolean existsByCode(String code);
    Page<TrainingClass> findByCodeContainingIgnoreCaseOrNameContainingIgnoreCase(
            String code,
            String name,
            Pageable pageable
    );
}