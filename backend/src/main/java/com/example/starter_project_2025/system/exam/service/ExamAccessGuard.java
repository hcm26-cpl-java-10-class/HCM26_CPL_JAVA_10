package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.Exam;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
public class ExamAccessGuard {

    public boolean canManage(Exam exam, UserPrincipal principal) {
        if (exam == null || principal == null || principal.getUser() == null) {
            return false;
        }
        if (!hasManageRole(principal)) {
            return false;
        }
        if (isAdmin(principal)) {
            return true;
        }
        Long currentUserId = principal.getUser().getId();
        return currentUserId != null && Objects.equals(exam.getCreatedBy(), currentUserId);
    }

    private boolean hasManageRole(UserPrincipal principal) {
        return principal.getUser().getRoles() != null
                && principal.getUser().getRoles().stream()
                .anyMatch(role -> "ADMIN".equals(role.getName()) || "TEACHER".equals(role.getName()));
    }

    public void checkCanManage(Exam exam, UserPrincipal principal) {
        if (!canManage(exam, principal)) {
            throw new BadRequestException("Bạn không có quyền quản lý lời mời của đề thi này");
        }
    }

    public boolean isOwnerScoped(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null || principal.getUser().getRoles() == null) {
            return false;
        }
        boolean teacher = principal.getUser().getRoles().stream()
                .anyMatch(role -> "TEACHER".equals(role.getName()));
        return teacher && !isAdmin(principal);
    }

    public boolean isAdmin(UserPrincipal principal) {
        return principal != null
                && principal.getUser() != null
                && principal.getUser().getRoles() != null
                && principal.getUser().getRoles().stream()
                .anyMatch(role -> "ADMIN".equals(role.getName()));
    }
}