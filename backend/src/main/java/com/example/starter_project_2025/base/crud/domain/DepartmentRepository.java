package com.example.starter_project_2025.base.crud.domain;

import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DepartmentRepository extends BaseCrudRepository<Department, UUID> {

    boolean existsByCode(String code);

    boolean existsByCodeAndIdNot(String code, UUID id);

    boolean existsByParentIdAndStatus(UUID parentId, DepartmentStatus status);

    List<Department> findByParentIsNull();
}