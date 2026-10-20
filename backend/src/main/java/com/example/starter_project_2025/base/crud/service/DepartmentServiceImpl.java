package com.example.starter_project_2025.base.crud.service;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.domain.Department;
import com.example.starter_project_2025.base.crud.domain.DepartmentRepository;
import com.example.starter_project_2025.base.crud.domain.DepartmentStatus;
import com.example.starter_project_2025.base.crud.dto.DepartmentDTO;
import com.example.starter_project_2025.base.crud.dto.DepartmentFilter;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.DepartmentMapper;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class DepartmentServiceImpl
        extends BaseCrudServiceImpl<Department, Long, DepartmentDTO, DepartmentFilter>
        implements DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final DepartmentMapper departmentMapper;

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
        return new String[]{"code", "name"};
    }

    @Override
    protected void beforeCreate(Department entity, DepartmentDTO request, ValidationContext ctx) {
        if (departmentRepository.existsByCode(request.getCode())) {
            ctx.add("code", "Mã phòng ban đã tồn tại: " + request.getCode());
        }

        if (request.getParentDepartmentId() != null) {
            Department parent = departmentRepository.findById(request.getParentDepartmentId()).orElse(null);
            if (parent == null) {
                ctx.add("parentDepartmentId", "Phòng ban cha không tồn tại");
            } else {
                entity.setParent(parent);
            }
        }
    }

    @Override
    protected void beforeUpdate(Department entity, DepartmentDTO request, ValidationContext ctx) {
        if (departmentRepository.existsByCodeAndIdNot(request.getCode(), entity.getId())) {
            ctx.add("code", "Mã phòng ban đã trùng lặp: " + request.getCode());
        }

        Long newParentId = request.getParentDepartmentId();
        if (newParentId != null) {
            if (Objects.equals(entity.getId(), newParentId)) {
                ctx.add("parentDepartmentId", "Phòng ban không thể chọn chính mình làm cha!");
            } else if (isCircularDependency(entity.getId(), newParentId)) {
                ctx.add("parentDepartmentId", "Không thể chọn phòng ban con/cháu làm phòng ban cha!");
            } else {
                Department parent = departmentRepository.findById(newParentId).orElse(null);
                if (parent == null) {
                    ctx.add("parentDepartmentId", "Phòng ban cha không tồn tại");
                } else {
                    entity.setParent(parent);
                }
            }
        } else {
            entity.setParent(null);
        }

        if (request.getStatus() == DepartmentStatus.INACTIVE && entity.getStatus() == DepartmentStatus.ACTIVE) {
            if (departmentRepository.existsByParentIdAndStatus(entity.getId(), DepartmentStatus.ACTIVE)) {
                ctx.add("status", "Không thể vô hiệu hóa phòng ban đang có phòng ban con hoạt động!");
            }
        }
    }

    @Override
    protected void beforeDelete(Department entity) {
        if (departmentRepository.existsByParentIdAndStatus(entity.getId(), DepartmentStatus.ACTIVE)) {
            throw new BadRequestException("Không thể xóa phòng ban đang có phòng ban con tồn tại!");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<DepartmentDTO> getDepartmentTree() {
        checkPermission(com.example.starter_project_2025.base.crud.CrudAction.READ);
        List<Department> roots = departmentRepository.findByParentIsNull();
        return roots.stream().map(departmentMapper::toResponse).toList();
    }

    private boolean isCircularDependency(Long currentDeptId, Long targetParentId) {
        Long ancestorId = targetParentId;
        while (ancestorId != null) {
            if (Objects.equals(ancestorId, currentDeptId)) {
                return true;
            }
            Department parentDept = departmentRepository.findById(ancestorId).orElse(null);
            ancestorId = (parentDept != null && parentDept.getParent() != null)
                    ? parentDept.getParent().getId()
                    : null;
        }
        return false;
    }
}