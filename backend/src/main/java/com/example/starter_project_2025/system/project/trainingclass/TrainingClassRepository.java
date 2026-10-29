package com.example.starter_project_2025.system.project.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TrainingClassRepository
        extends BaseCrudRepository<TrainingClass, Long> {

    Optional<TrainingClass> findByIdAndTenantId(Long id, Long tenantId);

    Optional<TrainingClass> findByCodeAndTenantId(String code, Long tenantId);

    Optional<TrainingClass> findByCode(String code);

    boolean existsByCodeAndTenantId(String code, Long tenantId);

    boolean existsByTenantIdAndCohortId(Long tenantId, Long cohortId);

    java.util.List<TrainingClass> findAllByTenantIdAndCohortIdIsNotNull(Long tenantId);
}
