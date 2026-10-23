package com.example.starter_project_2025.system.rbac.user;

/**
 * DTO nhẹ dùng cho danh sách sinh viên, phục vụ chức năng chọn nhiều sinh viên
 * khi tạo lời mời hàng loạt.
 */
public record StudentSummaryDTO(
        Long id,
        String email,
        String fullName
) {
}
