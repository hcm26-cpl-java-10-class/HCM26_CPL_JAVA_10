package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LocationRepository extends BaseCrudRepository<Location, Long> {
    List<Location> findByParentId(Long parentId);
    List<Location> findByParentIdIsNull();
    boolean existsByCode(String code);
}