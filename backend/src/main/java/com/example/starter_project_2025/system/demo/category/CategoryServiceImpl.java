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
        if (categoryRepository.existsByCodeIgnoreCase(request.getCode())) {
            ctx.add("code", "Category code already exists");
        }
        resolveParent(category, request, null, ctx);
    }

    @Override
    protected void beforeUpdate(Category category, CategoryDTO request, ValidationContext ctx) {
        if (request.getCode() != null
                && categoryRepository.existsByCodeIgnoreCaseAndIdNot(request.getCode(), category.getId())) {
            ctx.add("code", "Category code already exists");
        }
        resolveParent(category, request, category.getId(), ctx);
    }

    @Override
    protected void beforeDelete(Category category) {
        if (categoryRepository.existsByParentId(category.getId())) {
            throw new BadRequestException(
                    "Cannot delete category '" + category.getName() + "' because it has sub-categories");
        }
    }

    /**
     * parentId lấy từ request, null = danh mục gốc.
     * Chặn: parent không tồn tại, tự làm cha của chính mình, hoặc chọn con/cháu làm cha (vòng lặp).
     */
    private void resolveParent(Category category, CategoryDTO request, Long selfId, ValidationContext ctx) {
        Long parentId = request.getParentId();
        if (parentId == null) {
            category.setParent(null);
            return;
        }
        if (parentId.equals(selfId)) {
            ctx.add("parentId", "A category cannot be its own parent");
            return;
        }
        Category parent = categoryRepository.findById(parentId).orElse(null);
        if (parent == null) {
            ctx.add("parentId", "Parent category not found");
            return;
        }
        for (Category p = parent; p != null && selfId != null; p = p.getParent()) {
            if (selfId.equals(p.getId())) {
                ctx.add("parentId", "Parent cannot be a descendant of this category");
                return;
            }
        }
        category.setParent(parent);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryTreeDTO> getTree(boolean onlyActive) {
        checkPermission(CrudAction.READ);

        List<Category> all = categoryRepository.findAll(Sort.by("name"));
        Map<Long, CategoryTreeDTO> nodes = new HashMap<>();
        for (Category c : all) {
            if (onlyActive && !Boolean.TRUE.equals(c.getIsActive())) continue;
            nodes.put(c.getId(), CategoryTreeDTO.builder()
                    .id(c.getId())
                    .name(c.getName())
                    .code(c.getCode())
                    .description(c.getDescription())
                    .isActive(c.getIsActive())
                    .parentId(c.getParent() != null ? c.getParent().getId() : null)
                    .build());
        }

        List<CategoryTreeDTO> roots = new ArrayList<>();
        for (CategoryTreeDTO node : nodes.values()) {
            CategoryTreeDTO parent = node.getParentId() != null ? nodes.get(node.getParentId()) : null;
            if (parent != null) parent.getChildren().add(node);
            else roots.add(node);
        }
        sortRecursively(roots);
        return roots;
    }

    private void sortRecursively(List<CategoryTreeDTO> list) {
        list.sort(Comparator.comparing(CategoryTreeDTO::getName, String.CASE_INSENSITIVE_ORDER));
        list.forEach(n -> sortRecursively(n.getChildren()));
    }
}