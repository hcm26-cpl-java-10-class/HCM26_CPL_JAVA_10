package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface LessonMapper extends BaseCrudMapper<Lesson, LessonDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "section", ignore = true)
    Lesson toEntity(LessonDTO dto);

    @Override
    @Mapping(source = "section.id", target = "sectionId")
    LessonDTO toResponse(Lesson entity);

    @Override
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "section", ignore = true)
    void update(@MappingTarget Lesson entity, LessonDTO dto);
}
