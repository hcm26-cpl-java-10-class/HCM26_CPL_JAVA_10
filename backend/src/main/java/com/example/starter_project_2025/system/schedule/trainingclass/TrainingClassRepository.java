package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;

public interface TrainingClassRepository
        extends BaseCrudRepository<TrainingClass, Long> {

    boolean existsByCode(String code);
}