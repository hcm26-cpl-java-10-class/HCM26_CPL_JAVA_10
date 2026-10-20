package com.example.starter_project_2025.base.crud.domain;

import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Set;

@Repository
public interface DepartmentRepository extends BaseCrudRepository<Department, Long> {

    boolean existsByCode(String code);

    boolean existsByCodeAndIdNot(String code, Long id);

    boolean existsByParentIdAndStatus(Long parentId, DepartmentStatus status);

    List<Department> findByParentIsNull();

    // Phương thức này giải quyết lỗi "cannot find symbol method countByIdIn" trong UserServiceImpl
    long countByIdIn(Set<Long> ids);
}