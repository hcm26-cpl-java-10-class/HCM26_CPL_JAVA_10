package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

public interface RoleService
        extends BaseCrudService<Long, RoleDTO, RoleFilter> {

    Page<RoleDTO> searchRoles(String keyword, Pageable pageable);

    RoleDTO updateRoleStatus(Long id, boolean isActive);

    void deleteRole(Long id);

    ImportResult importRoles(MultipartFile file);
}
