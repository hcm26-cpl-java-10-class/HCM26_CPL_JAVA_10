package com.example.starter_project_2025.system.rbac.department;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DepartmentServiceImpl
        extends BaseCrudServiceImpl<Department, Long, DepartmentDTO, DepartmentFilter>
        implements DepartmentService {

    DepartmentMapper departmentMapper;
    DepartmentRepository departmentRepository;
    UserRepository userRepository;

    @Override
    protected BaseCrudRepository<Department, Long> getRepository() {
        return departmentRepository;
    }

    @Override
    protected BaseCrudMapper<Department, DepartmentDTO> getMapper() {
        return departmentMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"code", "name", "description"};
    }

    @Override
    protected void beforeCreate(Department department, DepartmentDTO request, ValidationContext ctx) {

        normalize(request);

        validateCodeUnique(request.getCode(), null, ctx);

        Department parent = resolveParent(request.getParentDepartmentId(), null, ctx);

        department.setCode(request.getCode());
        department.setName(request.getName());
        department.setDescription(request.getDescription());
        department.setParentDepartment(parent);
    }

    @Override
    protected void beforeUpdate(Department department, DepartmentDTO request, ValidationContext ctx) {

        normalize(request);

        if (request.getCode() != null) {
            validateCodeUnique(request.getCode(), department.getId(), ctx);
        }

        // PUT luôn áp dụng parent: null = chuyển thành phòng ban gốc.
        Department parent = resolveParent(request.getParentDepartmentId(), department.getId(), ctx);

        if (!ctx.hasErrors()) {
            department.setParentDepartment(parent);
        }
    }

    @Override
    protected void beforeDelete(Department department) {

        ValidationContext ctx = new ValidationContext();

        if (departmentRepository.existsByParentDepartmentId(department.getId())) {
            ctx.add("id", "Cannot delete a department that still has child departments");
        }

        if (userRepository.existsByDepartmentsId(department.getId())) {
            ctx.add("id", "Cannot delete a department that still has users assigned");
        }

        ctx.throwIfErrors();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DepartmentTreeDTO> getTree() {

        checkPermission(CrudAction.READ);

        List<Department> all = departmentRepository.findAll();

        Map<Long, List<Department>> childrenByParent = new HashMap<>();
        List<Department> roots = new ArrayList<>();

        for (Department d : all) {
            Department parent = d.getParentDepartment();
            if (parent == null) {
                roots.add(d);
            } else {
                childrenByParent.computeIfAbsent(parent.getId(), k -> new ArrayList<>()).add(d);
            }
        }

        return roots.stream()
                .sorted(Comparator.comparing(Department::getName, String.CASE_INSENSITIVE_ORDER))
                .map(d -> toNode(d, childrenByParent))
                .toList();
    }

    private DepartmentTreeDTO toNode(Department d, Map<Long, List<Department>> childrenByParent) {

        List<DepartmentTreeDTO> children = childrenByParent
                .getOrDefault(d.getId(), List.of())
                .stream()
                .sorted(Comparator.comparing(Department::getName, String.CASE_INSENSITIVE_ORDER))
                .map(c -> toNode(c, childrenByParent))
                .toList();

        return new DepartmentTreeDTO(d.getId(), d.getCode(), d.getName(), d.getIsActive(), children);
    }

    private void normalize(DepartmentDTO request) {
        if (request.getCode() != null) {
            request.setCode(request.getCode().trim());
        }
        if (request.getName() != null) {
            request.setName(request.getName().trim());
        }
        if (request.getDescription() != null) {
            request.setDescription(request.getDescription().trim());
        }
    }

    private void validateCodeUnique(String code, Long currentId, ValidationContext ctx) {

        if (code == null) {
            return;
        }

        Optional<Department> existing = departmentRepository.findByCodeIgnoreCase(code);

        if (existing.isPresent()
                && (currentId == null || !existing.get().getId().equals(currentId))) {

            ctx.add("code", "Department code is already in use");
        }
    }

    /**
     * Tìm phòng ban cha và kiểm tra: tồn tại, không phải chính nó, không tạo vòng lặp
     * (cha không được là con/cháu của phòng ban đang sửa).
     */
    private Department resolveParent(Long parentId, Long currentId, ValidationContext ctx) {

        if (parentId == null) {
            return null;
        }

        if (parentId.equals(currentId)) {
            ctx.add("parentDepartmentId", "A department cannot be its own parent");
            return null;
        }

        Optional<Department> parent = departmentRepository.findById(parentId);

        if (parent.isEmpty()) {
            ctx.add("parentDepartmentId", "Parent department does not exist");
            return null;
        }

        if (currentId != null) {
            Department cursor = parent.get().getParentDepartment();
            Set<Long> visited = new HashSet<>();

            while (cursor != null && visited.add(cursor.getId())) {
                if (cursor.getId().equals(currentId)) {
                    ctx.add("parentDepartmentId",
                            "Parent department cannot be a descendant of this department");
                    return null;
                }
                cursor = cursor.getParentDepartment();
            }
        }

        return parent.get();
    }
}
