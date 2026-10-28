package com.example.starter_project_2025.base.crud.domain;

import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface LocationRepository extends BaseCrudRepository<Location, UUID> {
    List<Location> findByParentId(UUID parentId);
    boolean existsByCode(String code);
}