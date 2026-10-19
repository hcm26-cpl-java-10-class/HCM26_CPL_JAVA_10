package com.example.starter_project_2025.system.demo.online_lession;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.*;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface LessonMapper extends BaseCrudMapper<Lesson, LessonDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "course", ignore = true)
    Lesson toEntity(LessonDTO dto);

    @Override
    @Mapping(target = "courseId", source = "course.id")
    @Mapping(target = "courseName", source = "course.name")
    LessonDTO toResponse(Lesson entity);

    @Override
    @Mapping(target = "course", ignore = true)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void update(@MappingTarget Lesson entity, LessonDTO dto);
}
