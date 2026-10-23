package com.example.starter_project_2025.system.project.task;

public class TaskConflictException extends RuntimeException {
    public static final String STALE_MESSAGE =
            "Dữ liệu Task đã bị thay đổi bởi thành viên khác, vui lòng tải lại trang";

    public TaskConflictException(String message) {
        super(message);
    }
}
