package com.example.starter_project_2025.system.demo.department;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DepartmentServiceImpl
        extends BaseCrudServiceImpl<
        Department, Long, DepartmentDTO, DepartmentFilter>
        implements DepartmentService {

    DepartmentRepository departmentRepository;
    DepartmentMapper departmentMapper;
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
        return new String[]{"name", "code", "description"};
    }

    @Override
    protected void beforeCreate(
            Department department,
            DepartmentDTO request,
            ValidationContext ctx) {

        if (departmentRepository.existsByCodeIgnoreCase(
                request.getCode())) {
            ctx.add("code", "Department code already exists");
        }

        if (departmentRepository.existsByNameIgnoreCase(
                request.getName())) {
            ctx.add("name", "Department name already exists");
        }
    }

    @Override
    protected void beforeUpdate(
            Department department,
            DepartmentDTO request,
            ValidationContext ctx) {

        if (request.getCode() != null
                && departmentRepository.existsByCodeIgnoreCaseAndIdNot(
                request.getCode(), department.getId())) {
            ctx.add("code", "Department code already exists");
        }

        if (request.getName() != null
                && departmentRepository.existsByNameIgnoreCaseAndIdNot(
                request.getName(), department.getId())) {
            ctx.add("name", "Department name already exists");
        }
    }

    @Override
    protected void beforeDelete(Department department) {
        if (userRepository.existsByDepartment_Id(department.getId())) {
            throw new BadRequestException(
                    "Cannot delete a department that still has members"
            );
        }
    }
}