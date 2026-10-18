package com.example.starter_project_2025.base.crud.service;

import com.example.starter_project_2025.base.crud.domain.Department;
import com.example.starter_project_2025.base.crud.domain.DepartmentRepository;
import com.example.starter_project_2025.base.crud.domain.DepartmentStatus;
import com.example.starter_project_2025.base.crud.dto.DepartmentDTO;
import com.example.starter_project_2025.base.crud.dto.DepartmentFilter;
import com.example.starter_project_2025.base.crud.mapper.DepartmentMapper;
import com.example.starter_project_2025.exception.BadRequestException;
import com.fams.iam.repository.UserDepartmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class DepartmentServiceImpl
        extends BaseCrudServiceImpl<Department, UUID, DepartmentDTO, DepartmentFilter>
        implements DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final DepartmentMapper departmentMapper;
    private final UserDepartmentRepository userDepartmentRepository;

    public DepartmentServiceImpl(
            DepartmentRepository repository,
            DepartmentMapper mapper,
            UserDepartmentRepository userDepartmentRepository) {
        super(repository, mapper);
        this.departmentRepository = repository;
        this.departmentMapper = mapper;
        this.userDepartmentRepository = userDepartmentRepository;
    }

    @Override
    @Transactional
    public DepartmentDTO createDepartment(DepartmentDTO dto) {
        if (departmentRepository.existsByCode(dto.getCode())) {
            throw new BadRequestException("Mã phòng ban đã tồn tại: " + dto.getCode());
        }

        Department parent = null;
        if (dto.getParentDepartmentId() != null) {
            parent = departmentRepository.findById(dto.getParentDepartmentId())
                    .orElseThrow(() -> new BadRequestException("Phòng ban cha không tồn tại"));
        }

        Department department = Department.builder()
                .code(dto.getCode().trim().toUpperCase())
                .name(dto.getName().trim())
                .parent(parent)
                .locationId(dto.getLocationId())
                .status(dto.getStatus() != null ? dto.getStatus() : DepartmentStatus.ACTIVE)
                .build();

        return departmentMapper.toDto(departmentRepository.save(department));
    }

    @Override
    @Transactional
    public DepartmentDTO updateDepartment(UUID id, DepartmentDTO dto) {
        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new BadRequestException("Phòng ban không tồn tại: " + id));

        if (departmentRepository.existsByCodeAndIdNot(dto.getCode(), id)) {
            throw new BadRequestException("Mã phòng ban đã trùng lặp: " + dto.getCode());
        }

        UUID newParentId = dto.getParentDepartmentId();
        if (newParentId != null) {
            validateNoCircularDependency(id, newParentId);
            Department parent = departmentRepository.findById(newParentId)
                    .orElseThrow(() -> new BadRequestException("Phòng ban cha không tồn tại"));
            department.setParent(parent);
        } else {
            department.setParent(null);
        }

        department.setCode(dto.getCode().trim().toUpperCase());
        department.setName(dto.getName().trim());
        department.setLocationId(dto.getLocationId());

        if (dto.getStatus() != null && dto.getStatus() != department.getStatus()) {
            if (dto.getStatus() == DepartmentStatus.INACTIVE) {
                validateDeactivation(id);
            }
            department.setStatus(dto.getStatus());
        }

        return departmentMapper.toDto(departmentRepository.save(department));
    }

    @Override
    @Transactional(readOnly = true)
    public List<DepartmentDTO> getDepartmentTree() {
        List<Department> roots = departmentRepository.findByParentIsNull();
        return roots.stream().map(departmentMapper::toDto).toList();
    }

    @Override
    @Transactional
    public void changeStatus(UUID id, DepartmentStatus status) {
        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new BadRequestException("Phòng ban không tồn tại: " + id));

        if (status == DepartmentStatus.INACTIVE) {
            validateDeactivation(id);
        }

        department.setStatus(status);
        departmentRepository.save(department);
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
            Department parentDept = departmentRepository.findById(ancestorId).orElse(null);
            ancestorId = (parentDept != null && parentDept.getParent() != null)
                    ? parentDept.getParent().getId()
                    : null;
        }
    }

    private void validateDeactivation(UUID deptId) {
        if (departmentRepository.existsByParentIdAndStatus(deptId, DepartmentStatus.ACTIVE)) {
            throw new BadRequestException("Không thể vô hiệu hóa phòng ban đang có phòng ban con hoạt động!");
        }
        if (userDepartmentRepository.existsByDepartmentId(deptId)) {
            throw new BadRequestException("Không thể vô hiệu hóa phòng ban đang có người dùng/nhân sự trực thuộc!");
        }
    }
}