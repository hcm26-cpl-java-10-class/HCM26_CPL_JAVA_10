package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface CourseMapper extends BaseCrudMapper<Course, CourseDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "instructorUser", ignore = true)
    @Mapping(target = "category", ignore = true)
    Course toEntity(CourseDTO dto);

    @Override
    @Mapping(source = "instructorUser.id", target = "instructorId")
    @Mapping(source = "category.id", target = "categoryId")
    @Mapping(source = "category.name", target = "categoryName")
    CourseDTO toResponse(Course entity);
}
