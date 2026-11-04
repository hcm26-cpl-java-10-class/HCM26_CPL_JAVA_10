package com.example.starter_project_2025.system.exam.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Kết quả xác minh mã truy cập.
 *
 * <p>Không trả về {@code examTitle}/{@code studentName} vì đây là endpoint public:
 * chỉ cần biết mã hợp lệ hay không trước khi người dùng xác nhận danh tính.
 */
@Data
@Builder
public class AnonymousAccessResponse {
    private boolean valid;
    private int accessAttemptsRemaining;
    private String message;
}
