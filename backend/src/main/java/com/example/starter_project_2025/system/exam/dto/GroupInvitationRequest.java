package com.example.starter_project_2025.system.exam.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Yêu cầu mời dự thi hàng loạt theo lớp (course).
 *
 * <p>Nếu {@code userIds} để trống thì mời toàn bộ học viên đang đăng ký lớp.
 */
@Getter
@Setter
public class GroupInvitationRequest {

    /** Lớp (course) dùng làm nguồn danh sách học viên. */
    private Long courseId;

    /** Mã lớp (class code, VD: LOCAL_JAVA_01) dùng hiển thị cột Source. */
    private String classCode;

    /** Danh sách học viên được chọn. Rỗng = toàn bộ học viên trong lớp. */
    private List<Long> userIds;

    private String note;

    private String availableFrom;

    private String expiresAt;

    /** Gửi email ngay sau khi tạo lời mời (mặc định có). */
    private boolean sendEmail = true;
}
