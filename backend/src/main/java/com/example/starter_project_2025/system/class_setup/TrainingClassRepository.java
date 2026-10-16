package com.example.starter_project_2025.system.class_setup;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TrainingClassRepository extends BaseCrudRepository<TrainingClass, Long> {

    Optional<TrainingClass> findByCode(String code);

    boolean existsByCode(String code);

    // Provided for BOSS: Check if any class is currently using the program
    boolean existsByProgramId(Long programId);
}
