package com.example.starter_project_2025.system.project;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CohortRepository extends JpaRepository<Cohort, Long> {
    java.util.Optional<Cohort> findByCodeAndTenantId(String code, Long tenantId);
}

