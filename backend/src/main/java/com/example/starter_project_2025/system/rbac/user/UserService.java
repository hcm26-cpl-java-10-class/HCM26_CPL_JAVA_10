package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import java.util.List;

public interface UserService
        extends BaseCrudService<Long, UserDTO, UserFilter> {

    void lockUser(Long userId);

    void unlockUser(Long userId);

    List<StudentSummaryDTO> findStudents();
}
