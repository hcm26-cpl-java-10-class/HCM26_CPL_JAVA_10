package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import com.example.starter_project_2025.system.demo.category.Category;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

import java.util.List;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface CourseMapper extends BaseCrudMapper<Course, CourseDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "instructorUser", ignore = true)
    @Mapping(target = "categories", ignore = true)
    @Mapping(target = "syllabus", ignore = true)
    Course toEntity(CourseDTO dto);

    @Override
    @Mapping(source = "instructorUser.id", target = "instructorId")
    @Mapping(target = "categoryIds", expression = "java(mapCategoryIds(entity))")
    @Mapping(target = "categoryNames", expression = "java(mapCategoryNames(entity))")
    @Mapping(target = "clearCategory", ignore = true)
    @Mapping(target = "clearSyllabus", ignore = true)
    @Mapping(source = "syllabus.id", target = "syllabusId")
    @Mapping(source = "syllabus.code", target = "syllabusCode")
    @Mapping(source = "syllabus.name", target = "syllabusName")
    CourseDTO toResponse(Course entity);

    @Override
    @Mapping(target = "instructorUser", ignore = true)
    @Mapping(target = "categories", ignore = true)
    @Mapping(target = "syllabus", ignore = true)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void update(@MappingTarget Course entity, CourseDTO dto);

    default List<Long> mapCategoryIds(Course entity) {
        if (entity.getCategories() == null) {
            return List.of();
        }
        return entity.getCategories().stream()
                .map(Category::getId)
                .toList();
    }

    default List<String> mapCategoryNames(Course entity) {
        if (entity.getCategories() == null) {
            return List.of();
        }
        return entity.getCategories().stream()
                .map(Category::getName)
                .toList();
    }
}
