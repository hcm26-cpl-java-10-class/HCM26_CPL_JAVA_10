package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

/**
 * The {@code sprint} association is never mapped from the DTO: it is resolved
 * by {@link SprintBacklogServiceImpl} (existing sprint check) and assigned on
 * the owning side there.
 */
@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface SprintBacklogMapper extends BaseCrudMapper<SprintBacklog, SprintBacklogDTO> {

    @Override
    @Mapping(target = "sprint", ignore = true)
    @Mapping(target = "version", ignore = true)
    SprintBacklog toEntity(SprintBacklogDTO request);

    @Override
    @Mapping(target = "sprintId", source = "sprint.id")
    @Mapping(target = "sprintName", source = "sprint.name")
    SprintBacklogDTO toResponse(SprintBacklog entity);

    @Override
    @Mapping(target = "sprint", ignore = true)
    @Mapping(target = "version", ignore = true)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void update(@MappingTarget SprintBacklog entity, SprintBacklogDTO request);
}
