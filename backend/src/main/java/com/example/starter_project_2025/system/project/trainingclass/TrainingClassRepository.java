package com.example.starter_project_2025.system.project.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TrainingClassRepository
        extends BaseCrudRepository<TrainingClass, Long> {

    boolean existsByProjectTemplate_Id(Long templateId);

    Optional<TrainingClass> findByIdAndTenantId(Long id, Long tenantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from TrainingClass c where c.id = :id")
    Optional<TrainingClass> findByIdForUpdate(Long id);

    Optional<TrainingClass> findByCodeAndTenantId(String code, Long tenantId);

    Optional<TrainingClass> findByCode(String code);

    boolean existsByCodeAndTenantId(String code, Long tenantId);
    boolean existsByTenantIdAndCohortId(Long tenantId, Long cohortId);

    java.util.List<TrainingClass> findAllByTenantIdAndCohortIdIsNotNull(Long tenantId);
}
