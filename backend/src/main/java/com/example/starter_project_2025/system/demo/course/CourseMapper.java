package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import com.example.starter_project_2025.system.demo.category.Category;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface CourseMapper extends BaseCrudMapper<Course, CourseDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "instructorUser", ignore = true)
    Course toEntity(CourseDTO dto);

    @Override
    @Mapping(source = "instructorUser.id", target = "instructorId")
    @Mapping(source = "categories", target = "categoryIds")   // <-- thêm dòng này
    CourseDTO toResponse(Course entity);

    default List<Long> categoriesToIds(Set<Category> categories) {
        if (categories == null) return Collections.emptyList();
        return categories.stream().map(Category::getId).collect(Collectors.toList());
    }

    default Set<Category> idsToCategories(List<Long> ids) {
        // Mapping from ids -> entities requires service/repo; MapStruct cannot load entities by id here.
        // So mapstruct will only handle DTO->entity shallow; actual association set in CourseServiceImpl
        return ids == null ? Collections.emptySet() : ids.stream().map(id -> {
            Category c = new Category();
            c.setId(id);
            return c;
        }).collect(Collectors.toSet());
    }
}
