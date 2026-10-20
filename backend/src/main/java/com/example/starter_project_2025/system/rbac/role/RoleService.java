package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface RoleService
        extends BaseCrudService<Long, RoleDTO, RoleFilter> {

    Page<RoleDTO> searchRoles(String keyword, Pageable pageable);

    RoleDTO updateRoleStatus(Long id, boolean isActive);

    void deleteRole(Long id);
}
