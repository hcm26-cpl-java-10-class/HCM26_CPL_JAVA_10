package com.example.starter_project_2025.system.rbac.permission;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PermissionRepository extends BaseCrudRepository<Permission, Long> {

    Optional<Permission> findByName(String name);

    List<Permission> findByAction(String action);

    Long countByIdIn(Iterable<Long> ids);

    boolean existsByName(String name);
}
