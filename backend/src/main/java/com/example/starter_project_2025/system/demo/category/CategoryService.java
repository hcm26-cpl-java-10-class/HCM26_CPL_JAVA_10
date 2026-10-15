package com.example.starter_project_2025.system.demo.category;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import java.util.List;

public interface CategoryService
        extends BaseCrudService<Long, CategoryDTO, CategoryFilter> {

    List<CategoryTreeDTO> getTree(boolean activeOnly);
}