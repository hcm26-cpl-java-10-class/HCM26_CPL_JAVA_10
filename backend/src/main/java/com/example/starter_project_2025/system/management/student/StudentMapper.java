package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import com.example.starter_project_2025.system.training.ClassEnrollmentRepository;
import org.mapstruct.*;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public abstract class StudentMapper implements BaseCrudMapper<Student, StudentDTO> {

    @Autowired
    protected ClassEnrollmentRepository classEnrollmentRepository;

    @Override
    @IgnoreAuditFields
    @Mapping(target = "passwordHash", ignore = true)
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "mustChangePassword", ignore = true)
    public abstract Student toEntity(StudentDTO dto);

    @Override
    @Mapping(target = "trainingClassIds", ignore = true)
    @Mapping(target = "trainingClass", ignore = true)
    public abstract StudentDTO toResponse(Student entity);

    @AfterMapping
    protected void mapTrainingClasses(Student entity, @MappingTarget StudentDTO dto) {
        if (entity == null || entity.getId() == null) return;
        List<com.example.starter_project_2025.system.training.ClassEnrollment> enrollments =
                classEnrollmentRepository.findByTraineeIdAndIsActiveTrue(entity.getId());
        dto.setTrainingClassIds(enrollments.stream()
                .map(e -> e.getTrainingClass().getId())
                .distinct()
                .toList());
        dto.setTrainingClass(enrollments.stream()
                .map(e -> e.getTrainingClass().getCode())
                .filter(code -> code != null && !code.isBlank())
                .distinct()
                .sorted()
                .collect(java.util.stream.Collectors.joining(", ")));
    }

    @Override
    @IgnoreAuditFields
    @Mapping(target = "passwordHash", ignore = true)
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "mustChangePassword", ignore = true)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    public abstract void update(@MappingTarget Student entity, StudentDTO dto);
}
