package com.example.starter_project_2025.system.demo.category;

import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
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
    CourseRepository courseRepository;

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
        if (category.getDisplayOrder() == null) {
            category.setDisplayOrder(0);
        }
        resolveParent(category, request, null, ctx);
        checkDuplicateName(category.getName(), request.getParentId(), null, ctx);
    }

    @Override
    protected void beforeUpdate(Category category, CategoryDTO request, ValidationContext ctx) {
        if (request.getCode() != null
                && categoryRepository.existsByCodeIgnoreCaseAndIdNot(request.getCode(), category.getId())) {
            ctx.add("code", "Category code already exists");
        }
        resolveParent(category, request, category.getId(), ctx);
        String name = request.getName() != null ? request.getName() : category.getName();
        checkDuplicateName(name, request.getParentId(), category.getId(), ctx);
        if (Boolean.TRUE.equals(request.getIsActive())
                && category.getParent() != null
                && !Boolean.TRUE.equals(category.getParent().getIsActive())) {
            ctx.add("isActive", "Cannot activate a category whose parent category is inactive");
        }
    }

    /** Ẩn danh mục cha thì ẩn luôn toàn bộ danh mục con, cháu. */
    @Override
    protected void afterUpdate(Category category, CategoryDTO request) {
        if (!Boolean.FALSE.equals(request.getIsActive())) return;
        Map<Long, List<Category>> childrenByParent = new HashMap<>();
        for (Category c : categoryRepository.findAll()) {
            if (c.getParent() != null) {
                childrenByParent.computeIfAbsent(c.getParent().getId(), k -> new ArrayList<>()).add(c);
            }
        }
        List<Category> queue = new ArrayList<>(childrenByParent.getOrDefault(category.getId(), List.of()));
        while (!queue.isEmpty()) {
            Category current = queue.remove(queue.size() - 1);
            if (Boolean.TRUE.equals(current.getIsActive())) {
                current.setIsActive(false);
                categoryRepository.save(current);
            }
            queue.addAll(childrenByParent.getOrDefault(current.getId(), List.of()));
        }
    }

    /** Tên danh mục không được trùng trong cùng một danh mục cha (không phân biệt hoa thường). */
    private void checkDuplicateName(String name, Long parentId, Long selfId, ValidationContext ctx) {
        if (name == null || name.isBlank()) return;
        boolean exists;
        if (selfId == null) {
            exists = parentId == null
                    ? categoryRepository.existsByNameIgnoreCaseAndParentIdIsNull(name)
                    : categoryRepository.existsByNameIgnoreCaseAndParentId(name, parentId);
        } else {
            exists = parentId == null
                    ? categoryRepository.existsByNameIgnoreCaseAndParentIdIsNullAndIdNot(name, selfId)
                    : categoryRepository.existsByNameIgnoreCaseAndParentIdAndIdNot(name, parentId, selfId);
        }
        if (exists) {
            ctx.add("name", "A category with this name already exists under the same parent");
        }
    }

    @Override
    protected void beforeDelete(Category category) {
        if (categoryRepository.existsByParentId(category.getId())) {
            throw new BadRequestException(
                    "Cannot delete category '" + category.getName() + "' because it has sub-categories");
        }
        if (courseRepository.existsByCategories_Id(category.getId())) {
            throw new BadRequestException(
                    "Cannot delete category '" + category.getName() + "' because it is used by courses");
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
        boolean sameParent = category.getParent() != null && parentId.equals(category.getParent().getId());
        if (!sameParent && !Boolean.TRUE.equals(parent.getIsActive())) {
            ctx.add("parentId", "Parent category is inactive");
            return;
        }
        category.setParent(parent);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryTreeDTO> getTree(boolean onlyActive) {
        checkPermission(CrudAction.READ);

        Map<Long, Long> courseCounts = new HashMap<>();
        for (Object[] row : courseRepository.countPublishedByCategory()) {
            courseCounts.put((Long) row[0], (Long) row[1]);
        }

        List<Category> all = categoryRepository.findAll();
        Map<Long, CategoryTreeDTO> nodes = new HashMap<>();
        for (Category c : all) {
            if (onlyActive && !Boolean.TRUE.equals(c.getIsActive())) continue;
            long own = courseCounts.getOrDefault(c.getId(), 0L);
            nodes.put(c.getId(), CategoryTreeDTO.builder()
                    .id(c.getId())
                    .name(c.getName())
                    .code(c.getCode())
                    .description(c.getDescription())
                    .iconUrl(c.getIconUrl())
                    .displayOrder(c.getDisplayOrder() == null ? 0 : c.getDisplayOrder())
                    .isActive(c.getIsActive())
                    .parentId(c.getParent() != null ? c.getParent().getId() : null)
                    .courseCount(own)
                    .totalCourseCount(own)
                    .build());
        }

        List<CategoryTreeDTO> roots = new ArrayList<>();
        for (CategoryTreeDTO node : nodes.values()) {
            if (node.getParentId() == null) {
                roots.add(node);
                continue;
            }
            CategoryTreeDTO parent = nodes.get(node.getParentId());
            // Cha bị ẩn thì con không được "nhảy" lên làm danh mục gốc.
            if (parent != null) parent.getChildren().add(node);
        }
        sortRecursively(roots);
        roots.forEach(this::computeTotals);
        if (onlyActive) {
            // Bộ lọc catalog: bỏ danh mục không có khóa học nào (kể cả ở các danh mục con).
            pruneEmpty(roots);
        }
        return roots;
    }

    private long computeTotals(CategoryTreeDTO node) {
        long total = node.getCourseCount();
        for (CategoryTreeDTO child : node.getChildren()) {
            total += computeTotals(child);
        }
        node.setTotalCourseCount(total);
        return total;
    }

    private void pruneEmpty(List<CategoryTreeDTO> list) {
        list.removeIf(n -> n.getTotalCourseCount() == 0);
        list.forEach(n -> pruneEmpty(n.getChildren()));
    }

    private void sortRecursively(List<CategoryTreeDTO> list) {
        list.sort(Comparator.comparing(CategoryTreeDTO::getDisplayOrder)
                .thenComparing(CategoryTreeDTO::getName, String.CASE_INSENSITIVE_ORDER));
        list.forEach(n -> sortRecursively(n.getChildren()));
    }
}