package com.example.starter_project_2025.system.project;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import java.util.Optional;

public interface TenantRepository extends JpaRepository<Tenant, Long> {
    Optional<Tenant> findByCode(String code);
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select t from Tenant t where t.id = :id")
    Optional<Tenant> findForWorkspaceCreation(Long id);
}
