package com.example.starter_project_2025.system.menu.module;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.*;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface ModuleMapper extends BaseCrudMapper<Module, ModuleDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "moduleGroup.id", source = "moduleGroupId")
    Module toEntity(ModuleDTO dto);

    @Override
    @Mapping(target = "moduleGroupId", source = "moduleGroup.id")
    ModuleDTO toResponse(Module entity);

    @Override
    @Mapping(target = "moduleGroup.id", source = "moduleGroupId")
    void update(@MappingTarget Module entity, ModuleDTO dto);
}