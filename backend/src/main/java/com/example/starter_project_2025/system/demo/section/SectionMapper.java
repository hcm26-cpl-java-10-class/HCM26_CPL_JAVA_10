
package com.example.starter_project_2025.system.demo.section;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface SectionMapper
        extends BaseCrudMapper<Section, SectionDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "course", ignore = true)
    Section toEntity(SectionDTO dto);

    @Override
    @Mapping(source = "course.id", target = "courseId")
    SectionDTO toResponse(Section entity);

    @Override
    @BeanMapping(
            nullValuePropertyMappingStrategy =
                    NullValuePropertyMappingStrategy.IGNORE
    )
    @Mapping(target = "course", ignore = true)
    void update(@MappingTarget Section entity, SectionDTO dto);
}
