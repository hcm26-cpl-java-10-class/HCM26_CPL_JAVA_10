package com.example.starter_project_2025.exception.error;

import com.example.starter_project_2025.web.CorrelationIdFilter;

import java.time.LocalDateTime;

/**
 * Chuẩn lỗi của module i18n.
 *
 * <p>Tách khỏi {@link ErrorResponse} để không đổi cấu trúc response của các API đang
 * hoạt động, đồng thời bổ sung mã lỗi ổn định để frontend xử lý theo mã thay vì theo
 * message.
 *
 * @param status       mã HTTP
 * @param code         mã lỗi ổn định, ví dụ {@code ERR_I18N_UNSUPPORTED_LANGUAGE}
 * @param message      thông báo cho người dùng
 * @param timestamp    thời điểm xảy ra lỗi
 * @param correlationId id để tra cứu log
 */
public record I18nErrorResponse(
        int status,
        String code,
        String message,
        LocalDateTime timestamp,
        String correlationId
) {

    public I18nErrorResponse(int status, String code, String message, LocalDateTime timestamp) {
        this(status, code, message, timestamp, CorrelationIdFilter.currentId());
    }
}
