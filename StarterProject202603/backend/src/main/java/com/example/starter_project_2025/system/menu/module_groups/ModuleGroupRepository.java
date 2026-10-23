package com.example.starter_project_2025.system.menu.module_groups;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ModuleGroupRepository
        extends BaseCrudRepository<ModuleGroup, Long> {

    boolean existsByNameIgnoreCase(String name);

    Optional<ModuleGroup> findByName(String name);
}