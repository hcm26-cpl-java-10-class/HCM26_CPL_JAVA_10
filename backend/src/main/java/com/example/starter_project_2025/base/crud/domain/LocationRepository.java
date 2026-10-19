package com.example.starter_project_2025.base.crud.domain;

import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LocationRepository extends BaseCrudRepository<Location, Long> {
    List<Location> findByParentId(Long parentId);
    boolean existsByCode(String code);
}