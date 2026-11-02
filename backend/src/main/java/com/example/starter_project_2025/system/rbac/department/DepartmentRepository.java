package com.example.starter_project_2025.system.rbac.department;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DepartmentRepository extends BaseCrudRepository<Department, Long> {

    Optional<Department> findByCode(String code);

    Optional<Department> findByCodeIgnoreCase(String code);

    boolean existsByParentDepartmentId(Long parentId);

    Long countByIdIn(Iterable<Long> ids);
}
