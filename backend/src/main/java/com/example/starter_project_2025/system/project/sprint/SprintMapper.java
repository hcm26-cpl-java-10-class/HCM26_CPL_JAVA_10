package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface SprintMapper extends BaseCrudMapper<Sprint, SprintDTO> {

    @Override
    @Mapping(target = "version", ignore = true)
    Sprint toEntity(SprintDTO request);

    @Override
    @Mapping(target = "version", ignore = true)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void update(@MappingTarget Sprint sprint, SprintDTO request);
}
