package com.example.starter_project_2025.system.menu.module_groups;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface ModuleGroupMapper extends BaseCrudMapper<ModuleGroup, ModuleGroupDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "modules", ignore = true)
    ModuleGroup toEntity(ModuleGroupDTO dto);
}