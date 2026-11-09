package com.example.starter_project_2025.system.project;

public class TeamVersionConflictException extends RuntimeException {

    public static final String MESSAGE =
            "Dữ liệu/Version nhóm đã bị thay đổi, vui lòng tải lại trang";

    public TeamVersionConflictException() {
        super(MESSAGE);
    }
}
