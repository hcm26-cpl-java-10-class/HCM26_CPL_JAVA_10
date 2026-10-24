package com.example.starter_project_2025.system.tenant;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TenantRepository extends BaseCrudRepository<Tenant, Long> {

    boolean existsByIdAndIsActiveTrue(Long id);

    java.util.Optional<Tenant> findByCode(String code);
}
