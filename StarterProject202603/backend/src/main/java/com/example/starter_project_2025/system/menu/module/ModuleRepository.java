package com.example.starter_project_2025.system.menu.module;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ModuleRepository extends BaseCrudRepository<Module, Long> {

    boolean existsByModuleGroupIdAndTitle(Long moduleGroupId, String title);

    boolean existsByUrl(String url);

    Optional<Module> findByUrl(String url);

    boolean existsByUrlAndIdNot(String url, Long id);

    List<Module> findByIsActive(Boolean isActive);
}

