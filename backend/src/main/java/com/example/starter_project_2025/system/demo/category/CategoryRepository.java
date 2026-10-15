package com.example.starter_project_2025.system.demo.category;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CategoryRepository extends BaseCrudRepository<Category, Long> {

    boolean existsByNameIgnoreCase(String name);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByParent_Id(Long parentId);

    Optional<Category> findByCodeIgnoreCase(String code);
}