package com.example.starter_project_2025.base.crud.service;

import com.example.starter_project_2025.base.crud.domain.Department;
import com.example.starter_project_2025.base.crud.domain.DepartmentRepository;
import com.example.starter_project_2025.base.crud.domain.DepartmentStatus;
import com.example.starter_project_2025.base.crud.dto.DepartmentDTO;
import com.example.starter_project_2025.base.crud.dto.DepartmentRequest;
import com.example.starter_project_2025.base.crud.mapper.DepartmentMapper;
import com.example.starter_project_2025.exception.BadRequestException;
import com.fams.iam.repository.UserDepartmentRepository; // Repository quản lý quan hệ User - Department
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class DepartmentServiceImpl
        extends BaseCrudServiceImpl<Department, UUID, DepartmentDTO, DepartmentRequest, DepartmentRepository, DepartmentMapper>
        implements DepartmentService {

    private final UserDepartmentRepository userDepartmentRepository;

    public DepartmentServiceImpl(
            DepartmentRepository repository,
            DepartmentMapper mapper,
            UserDepartmentRepository userDepartmentRepository) {
        super(repository, mapper);
        this.userDepartmentRepository = userDepartmentRepository;
    }

    @Override
    @Transactional
    public DepartmentDTO createDepartment(DepartmentRequest request) {
        if (repository.existsByCode(request.getCode())) {
            throw new BadRequestException("Mã phòng ban đã tồn tại: " + request.getCode());
        }

        Department parent = null;
        if (request.getParentDepartmentId() != null) {
            parent = repository.findById(request.getParentDepartmentId())
                    .orElseThrow(() -> new BadRequestException("Phòng ban cha không tồn tại"));
        }

        Department department = Department.builder()
                .code(request.getCode().trim().toUpperCase())
                .name(request.getName().trim())
                .parent(parent)
                .locationId(request.getLocationId())
                .status(request.getStatus() != null ? request.getStatus() : DepartmentStatus.ACTIVE)
                .build();

        return mapper.toDto(repository.save(department));
    }

    @Override
    @Transactional
    public DepartmentDTO updateDepartment(UUID id, DepartmentRequest request) {
        Department department = repository.findById(id)
                .orElseThrow(() -> new BadRequestException("Phòng ban không tồn tại: " + id));

        if (repository.existsByCodeAndIdNot(request.getCode(), id)) {
            throw new BadRequestException("Mã phòng ban đã trùng lặp: " + request.getCode());
        }

        UUID newParentId = request.getParentDepartmentId();
        if (newParentId != null) {
            validateNoCircularDependency(id, newParentId);
            Department parent = repository.findById(newParentId)
                    .orElseThrow(() -> new BadRequestException("Phòng ban cha không tồn tại"));
            department.setParent(parent);
        } else {
            department.setParent(null);
        }

        department.setCode(request.getCode().trim().toUpperCase());
        department.setName(request.getName().trim());
        department.setLocationId(request.getLocationId());

        if (request.getStatus() != null && request.getStatus() != department.getStatus()) {
            if (request.getStatus() == DepartmentStatus.INACTIVE) {
                validateDeactivation(id);
            }
            department.setStatus(request.getStatus());
        }

        return mapper.toDto(repository.save(department));
    }

    @Override
    @Transactional(readOnly = true)
    public List<DepartmentDTO> getDepartmentTree() {
        List<Department> roots = repository.findByParentIsNull();
        return roots.stream().map(mapper::toDto).toList();
    }

    @Override
    @Transactional
    public void changeStatus(UUID id, DepartmentStatus status) {
        Department department = repository.findById(id)
                .orElseThrow(() -> new BadRequestException("Phòng ban không tồn tại: " + id));

        if (status == DepartmentStatus.INACTIVE) {
            validateDeactivation(id);
        }

        department.setStatus(status);
        repository.save(department);
    }

    private void validateNoCircularDependency(UUID currentDeptId, UUID targetParentId) {
        if (Objects.equals(currentDeptId, targetParentId)) {
            throw new BadRequestException("Phòng ban không thể chọn chính mình làm cha!");
        }

        UUID ancestorId = targetParentId;
        while (ancestorId != null) {
            if (Objects.equals(ancestorId, currentDeptId)) {
                throw new BadRequestException("Không thể chọn phòng ban con/cháu làm phòng ban cha!");
            }
            Department parentDept = repository.findById(ancestorId).orElse(null);
            ancestorId = (parentDept != null && parentDept.getParent() != null)
                    ? parentDept.getParent().getId()
                    : null;
        }
    }

    private void validateDeactivation(UUID deptId) {
        // 1. Kiểm tra phòng ban con đang ACTIVE
        if (repository.existsByParentIdAndStatus(deptId, DepartmentStatus.ACTIVE)) {
            throw new BadRequestException("Không thể vô hiệu hóa phòng ban đang có phòng ban con hoạt động!");
        }

        // 2. Bổ sung kiểm tra User thuộc phòng ban theo yêu cầu Reviewer
        if (userDepartmentRepository.existsByDepartmentId(deptId)) {
            throw new BadRequestException("Không thể vô hiệu hóa phòng ban đang có người dùng/nhân sự trực thuộc!");
        }
    }
}