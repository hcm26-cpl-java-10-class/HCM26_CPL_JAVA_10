package com.example.starter_project_2025.system.project.resources.project_resources;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface ProjectResourceMapper extends BaseCrudMapper<ProjectResource, ProjectResourceDTO> {

    @Override
    @Mapping(target = "sourceTemplateSnapshotId", ignore = true)
    @Mapping(target = "sourceTemplateResourceId", ignore = true)
    ProjectResource toEntity(ProjectResourceDTO request);

    @Override
    @Mapping(target = "projectId", ignore = true)
    @Mapping(target = "tenantId", ignore = true)
    @Mapping(target = "sourceTemplateSnapshotId", ignore = true)
    @Mapping(target = "sourceTemplateResourceId", ignore = true)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void update(@MappingTarget ProjectResource entity, ProjectResourceDTO request);
}
