package com.example.starter_project_2025.system.demo.category;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/categories")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Category", description = "APIs for managing categories")
public class CategoryController
        extends BaseCrudDataIoController<Category, Long, CategoryDTO, CategoryFilter> {

    CategoryService categoryService;
    CategoryRepository categoryRepository;

    @Override
    protected BaseCrudService<Long, CategoryDTO, CategoryFilter> getService() {
        return categoryService;
    }

    @Override
    protected BaseCrudRepository<Category, Long> getRepository() {
        return categoryRepository;
    }

    @Override
    protected Class<Category> getEntityClass() {
        return Category.class;
    }

    @GetMapping("/tree")
    @Operation(summary = "Get the category hierarchy as a nested tree")
    public ResponseEntity<List<CategoryTreeDTO>> getTree(
            @RequestParam(defaultValue = "false") boolean activeOnly
    ) {
        return ResponseEntity.ok(categoryService.getTree(activeOnly));
    }
}