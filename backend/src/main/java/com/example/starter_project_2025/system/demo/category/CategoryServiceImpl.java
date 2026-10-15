package com.example.starter_project_2025.system.demo.category;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CategoryServiceImpl
        extends BaseCrudServiceImpl<Category, Long, CategoryDTO, CategoryFilter>
        implements CategoryService {

    CategoryMapper categoryMapper;
    CategoryRepository categoryRepository;

    @Override
    protected BaseCrudRepository<Category, Long> getRepository() {
        return categoryRepository;
    }

    @Override
    protected BaseCrudMapper<Category, CategoryDTO> getMapper() {
        return categoryMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"name", "code", "description"};
    }

    @Override
    protected void beforeCreate(Category category, CategoryDTO request, ValidationContext ctx) {

        String name = trim(request.getName());
        String code = normalizeCode(request.getCode());

        request.setName(name);
        request.setCode(code);
        category.setName(name);
        category.setCode(code);

        if (name != null && categoryRepository.existsByNameIgnoreCase(name)) {
            ctx.add("name", "Category name already exists");
        }
        if (code != null && categoryRepository.existsByCodeIgnoreCase(code)) {
            ctx.add("code", "Category code already exists");
        }

        Category parent = resolveParent(request.getParentId(), null, ctx);
        if (!ctx.hasErrors()) {
            category.setParent(parent);
        }
    }

    // parentId luôn được áp dụng khi update: null => chuyển về gốc
    @Override
    protected void beforeUpdate(Category category, CategoryDTO request, ValidationContext ctx) {

        if (request.getName() != null) {
            String name = trim(request.getName());
            request.setName(name);

            if (!name.equalsIgnoreCase(category.getName())
                    && categoryRepository.existsByNameIgnoreCase(name)) {
                ctx.add("name", "Category name already exists");
            }
        }

        if (request.getCode() != null) {
            String code = normalizeCode(request.getCode());
            request.setCode(code);

            if (!code.equalsIgnoreCase(category.getCode())
                    && categoryRepository.existsByCodeIgnoreCase(code)) {
                ctx.add("code", "Category code already exists");
            }
        }

        Category parent = resolveParent(request.getParentId(), category.getId(), ctx);
        if (!ctx.hasErrors()) {
            category.setParent(parent);
        }
    }

    @Override
    protected void beforeDelete(Category category) {
        if (categoryRepository.existsByParent_Id(category.getId())) {
            throw new BadRequestException(
                    "Cannot delete category '" + category.getName()
                            + "' because it still has child categories");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryTreeDTO> getTree(boolean activeOnly) {

        checkPermission(CrudAction.READ);

        List<Category> all = categoryRepository.findAll(Sort.by("name"));

        Map<Long, CategoryTreeDTO> nodes = new HashMap<>();
        for (Category c : all) {
            nodes.put(c.getId(), CategoryTreeDTO.builder()
                    .id(c.getId())
                    .name(c.getName())
                    .code(c.getCode())
                    .description(c.getDescription())
                    .isActive(c.getIsActive())
                    .parentId(c.getParent() == null ? null : c.getParent().getId())
                    .build());
        }

        List<CategoryTreeDTO> roots = new ArrayList<>();
        for (CategoryTreeDTO node : nodes.values()) {
            CategoryTreeDTO parentNode = node.getParentId() == null ? null : nodes.get(node.getParentId());
            if (parentNode == null) {
                roots.add(node);
            } else {
                parentNode.getChildren().add(node);
            }
        }

        Comparator<CategoryTreeDTO> byName =
                Comparator.comparing(n -> n.getName() == null ? "" : n.getName(), String.CASE_INSENSITIVE_ORDER);

        roots.sort(byName);
        nodes.values().forEach(n -> n.getChildren().sort(byName));

        return activeOnly ? pruneInactive(roots) : roots;
    }

    private List<CategoryTreeDTO> pruneInactive(List<CategoryTreeDTO> nodes) {
        List<CategoryTreeDTO> result = new ArrayList<>();
        for (CategoryTreeDTO node : nodes) {
            if (!Boolean.TRUE.equals(node.getIsActive())) {
                continue;
            }
            node.setChildren(pruneInactive(node.getChildren()));
            result.add(node);
        }
        return result;
    }

    private Category resolveParent(Long parentId, Long selfId, ValidationContext ctx) {

        if (parentId == null) {
            return null;
        }

        if (parentId.equals(selfId)) {
            ctx.add("parentId", "A category cannot be its own parent");
            return null;
        }

        Category parent = categoryRepository.findById(parentId).orElse(null);
        if (parent == null) {
            ctx.add("parentId", "Parent category not found");
            return null;
        }

        if (selfId != null) {
            Category cursor = parent.getParent();
            while (cursor != null) {
                if (selfId.equals(cursor.getId())) {
                    ctx.add("parentId", "Cannot move a category under one of its own descendants");
                    return null;
                }
                cursor = cursor.getParent();
            }
        }

        return parent;
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }

    private String normalizeCode(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }
}