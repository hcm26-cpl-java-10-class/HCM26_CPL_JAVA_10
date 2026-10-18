package com.example.starter_project_2025.base.crud.service;

import com.example.starter_project_2025.base.crud.domain.Department;
import com.example.starter_project_2025.base.crud.domain.DepartmentRepository;
import com.example.starter_project_2025.base.crud.dto.DepartmentDTO;
import com.example.starter_project_2025.base.crud.dto.DepartmentRequest;
import com.example.starter_project_2025.base.crud.mapper.DepartmentMapper;
import com.example.starter_project_2025.exception.BadRequestException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class DepartmentServiceImpl
        extends BaseCrudServiceImpl<Department, UUID, DepartmentDTO, DepartmentRequest, DepartmentRequest, DepartmentRepository, DepartmentMapper>
        implements DepartmentService {

    public DepartmentServiceImpl(DepartmentRepository repository, DepartmentMapper mapper) {
        super(repository, mapper);
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
                .status(request.getStatus() != null ? request.getStatus() : "ACTIVE")
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
            // Chống vòng lặp cây phòng ban (Cycle Detection)
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

        if (request.getStatus() != null && !request.getStatus().equalsIgnoreCase(department.getStatus())) {
            if ("INACTIVE".equalsIgnoreCase(request.getStatus())) {
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
    public void changeStatus(UUID id, String status) {
        Department department = repository.findById(id)
                .orElseThrow(() -> new BadRequestException("Phòng ban không tồn tại: " + id));

        if ("INACTIVE".equalsIgnoreCase(status)) {
            validateDeactivation(id);
        }

        department.setStatus(status);
        repository.save(department);
    }

    // THUẬT TOÁN 1: Duyệt ngược lên gốc để phát hiện vòng lặp
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

    // THUẬT TOÁN 2: Kiểm tra khi vô hiệu hóa
    private void validateDeactivation(UUID deptId) {
        if (repository.existsByParentIdAndStatus(deptId, "ACTIVE")) {
            throw new BadRequestException("Không thể vô hiệu hóa phòng ban đang có phòng ban con hoạt động!");
        }
    }
}