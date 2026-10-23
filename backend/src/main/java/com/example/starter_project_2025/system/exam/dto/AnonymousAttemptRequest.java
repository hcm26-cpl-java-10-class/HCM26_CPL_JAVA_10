package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/**
 * Request cho các endpoint làm bài của học sinh anonymous.
 * Phiên được xác thực bằng {@code sessionToken} (đã lưu ở sessionStorage
 * sau khi đổi access code thành công).
 */
@Getter
@Setter
public class AnonymousAttemptRequest {

    @NotBlank(message = "Session token is required")
    private String sessionToken;

    /** Mật khẩu đề thi (nếu đề có đặt mật khẩu). */
    private String password;
}