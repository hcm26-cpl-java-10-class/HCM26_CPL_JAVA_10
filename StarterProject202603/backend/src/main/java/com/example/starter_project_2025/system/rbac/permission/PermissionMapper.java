package com.example.starter_project_2025.system.rbac.permission;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface PermissionMapper extends BaseCrudMapper<Permission, PermissionDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "roles", ignore = true)
    Permission toEntity(PermissionDTO dto);

    @Override
    @Mapping(target = "roles", ignore = true)
    void update(@MappingTarget Permission entity, PermissionDTO dto);
}
