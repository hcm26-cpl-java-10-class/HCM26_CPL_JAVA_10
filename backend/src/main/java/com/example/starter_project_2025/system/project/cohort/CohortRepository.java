package com.example.starter_project_2025.system.project.cohort;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CohortRepository extends JpaRepository<Cohort, Long> {
    java.util.Optional<Cohort> findByCodeAndTenantId(String code, Long tenantId);
    java.util.List<Cohort> findAllByTenant_IdAndIsActiveTrueOrderByNameAsc(Long tenantId);
}

