package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.Exam;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * Data scope cho module Lời mời.
 *
 * <p>Quy tắc: chỉ ADMIN hoặc giáo viên đã tạo đề thi mới được quản lý lời mời của đề đó.
 * Các vai trò khác (sinh viên, trợ giảng...) không được phép đọc/ghi trên tài nguyên này.
 */
@Component
public class ExamAccessGuard {

    /**
     * @return true nếu người dùng hiện tại được phép quản lý đề thi & lời mời của đề.
     */
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

    /**
     * Chỉ ADMIN và TEACHER mới được phép quản lý lời mời.
     * Sinh viên dù có trùng id với chủ đề thi cũng không được phép.
     */
    private boolean hasManageRole(UserPrincipal principal) {
        if (principal.getUser().getRoles() == null) {
            return false;
        }
        return principal.getUser().getRoles().stream()
                .anyMatch(r -> "ADMIN".equals(r.getName()) || "TEACHER".equals(r.getName()));
    }

    /**
     * Ném {@link BadRequestException} nếu người dùng hiện tại không được phép quản lý đề.
     */
    public void checkCanManage(Exam exam, UserPrincipal principal) {
        if (!canManage(exam, principal)) {
            throw new BadRequestException("Bạn không có quyền quản lý lời mời của đề thi này");
        }
    }

    /**
     * Giao vien (TEACHER) khong phai ADMIN: chi duoc thay/quan ly de thi do chinh minh tao.
     * ADMIN thay tat ca; cac vai tro khac (vd. sinh vien) khong bi gioi han o day.
     */
    public boolean isOwnerScoped(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null || principal.getUser().getRoles() == null) {
            return false;
        }
        boolean teacher = principal.getUser().getRoles().stream().anyMatch(r -> "TEACHER".equals(r.getName()));
        return teacher && !isAdmin(principal);
    }

    public boolean isAdmin(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null || principal.getUser().getRoles() == null) {
            return false;
        }
        return principal.getUser().getRoles().stream()
                .anyMatch(r -> "ADMIN".equals(r.getName()));
    }
}
