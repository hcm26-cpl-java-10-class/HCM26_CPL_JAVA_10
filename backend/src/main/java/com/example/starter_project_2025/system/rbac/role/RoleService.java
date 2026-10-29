package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import java.util.Set;

public interface RoleService extends BaseCrudService<Long, RoleDTO, RoleFilter> {
    Set<Long> getPermissionIds(Long roleId);
    RoleDTO updatePermissions(Long roleId, Set<Long> permissionIds);
    RoleDTO setSystemRole(Long roleId, boolean isSystem);
}
