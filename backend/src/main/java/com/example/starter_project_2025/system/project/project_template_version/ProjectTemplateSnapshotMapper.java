package com.example.starter_project_2025.system.project.project_template_version;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface ProjectTemplateSnapshotMapper
        extends BaseCrudMapper<ProjectTemplateSnapshot, ProjectTemplateSnapshotDTO> {

    @Override
    @IgnoreAuditFields
    ProjectTemplateSnapshot toEntity(ProjectTemplateSnapshotDTO request);

    @Override
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void update(@MappingTarget ProjectTemplateSnapshot snapshot,
                ProjectTemplateSnapshotDTO request);
}
