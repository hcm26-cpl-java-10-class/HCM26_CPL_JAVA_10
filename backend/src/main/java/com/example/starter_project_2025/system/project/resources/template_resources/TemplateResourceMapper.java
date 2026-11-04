package com.example.starter_project_2025.system.project.resources.template_resources;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface TemplateResourceMapper extends BaseCrudMapper<TemplateResource, TemplateResourceDTO> {

    @Override
    TemplateResource toEntity(TemplateResourceDTO request);

    @Override
    @Mapping(target = "templateId", ignore = true)
    @Mapping(target = "templateVersionId", ignore = true)
    @Mapping(target = "tenantId", ignore = true)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void update(@MappingTarget TemplateResource entity, TemplateResourceDTO request);
}
