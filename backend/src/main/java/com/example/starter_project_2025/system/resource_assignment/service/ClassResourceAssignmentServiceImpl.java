package com.example.starter_project_2025.system.resource_assignment.service;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.resource_assignment.domain.ClassResourceAssignment;
import com.example.starter_project_2025.system.resource_assignment.domain.ResourceType;
import com.example.starter_project_2025.system.resource_assignment.dto.ClassResourceAssignmentDTO;
import com.example.starter_project_2025.system.resource_assignment.dto.ClassResourceAssignmentFilter;
import com.example.starter_project_2025.system.resource_assignment.mapper.ClassResourceAssignmentMapper;
import com.example.starter_project_2025.system.resource_assignment.repository.ClassResourceAssignmentRepository;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ClassResourceAssignmentServiceImpl
        extends BaseCrudServiceImpl<ClassResourceAssignment, Long, ClassResourceAssignmentDTO, ClassResourceAssignmentFilter>
        implements ClassResourceAssignmentService {

    ClassResourceAssignmentRepository repository;
    ClassResourceAssignmentMapper mapper;

    @Override
    protected BaseCrudRepository<ClassResourceAssignment, Long> getRepository() {
        return repository;
    }

    @Override
    protected BaseCrudMapper<ClassResourceAssignment, ClassResourceAssignmentDTO> getMapper() {
        return mapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"resourceName"};
    }

    @Override
    protected void beforeCreate(ClassResourceAssignment entity, ClassResourceAssignmentDTO request, ValidationContext ctx) {
        if (repository.existsByClassIdAndResourceIdAndResourceType(
                request.getClassId(),
                request.getResourceId(),
                request.getResourceType())) {

            ctx.add("resourceId", "This resource has already been assigned to this class with this role.");
        }
    }

    @Override
    protected void beforeUpdate(ClassResourceAssignment entity, ClassResourceAssignmentDTO request, ValidationContext ctx) {
        boolean isChanged = false;

        if (request.getClassId() != null && !request.getClassId().equals(entity.getClassId())) isChanged = true;
        if (request.getResourceId() != null && !request.getResourceId().equals(entity.getResourceId())) isChanged = true;
        if (request.getResourceType() != null && !request.getResourceType().equals(entity.getResourceType())) isChanged = true;

        if (isChanged) {
            Long checkClassId = request.getClassId() != null ? request.getClassId() : entity.getClassId();
            Long checkResId = request.getResourceId() != null ? request.getResourceId() : entity.getResourceId();
            ResourceType checkType = request.getResourceType() != null ? request.getResourceType() : entity.getResourceType();

            if (repository.existsByClassIdAndResourceIdAndResourceType(checkClassId, checkResId, checkType)) {
                ctx.add("resourceId", "This combination of Class, Resource, and Type already exists.");
            }
        }
    }
}