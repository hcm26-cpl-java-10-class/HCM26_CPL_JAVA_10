package com.example.starter_project_2025.system.rbac.department;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import java.util.List;

public interface DepartmentService
        extends BaseCrudService<Long, DepartmentDTO, DepartmentFilter> {

    /** Cây phòng ban: các nút gốc, mỗi nút chứa danh sách con. */
    List<DepartmentTreeDTO> getTree();
}
