package com.example.starter_project_2025.system.project.tenant;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface TenantRepository extends BaseCrudRepository<Tenant, Long> {

    Optional<Tenant> findByCode(String code);

    boolean existsByIdAndIsActiveTrue(Long id);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select t from Tenant t where t.id = :id")
    Optional<Tenant> findForWorkspaceCreation(Long id);
}
