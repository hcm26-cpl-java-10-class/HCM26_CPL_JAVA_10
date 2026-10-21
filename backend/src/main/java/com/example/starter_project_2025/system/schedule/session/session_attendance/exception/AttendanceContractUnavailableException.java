package com.example.starter_project_2025.system.schedule.session.session_attendance.exception;

import com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceCodes;

/**
 * T1 / mục 8 — Không gọi được contract (session/roster/class) ⇒ 503 và <b>không ghi một phần</b>.
 *
 * <p>Chỉ ném khi bật chế độ strict ({@code attendance.contract.strict=true}); mặc định module
 * fail-open giống {@code SessionStatusServiceImpl.requireClassOngoing} để không chặn nghiệp vụ
 * khi hệ thống nguồn tạm thời không sẵn sàng.</p>
 */
public class AttendanceContractUnavailableException extends RuntimeException {

    private final String code = AttendanceCodes.CONTRACT_UNAVAILABLE;

    public AttendanceContractUnavailableException(String message) {
        super(message);
    }

    public String getCode() {
        return code;
    }
}
