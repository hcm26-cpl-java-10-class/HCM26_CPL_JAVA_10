package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.BadRequestException;

public class InvalidMentorForClassException extends BadRequestException {

    public static final String MESSAGE =
            "Mentor được chọn không thuộc danh sách quản lý của Lớp học này.";

    public InvalidMentorForClassException() {
        super(MESSAGE);
    }
}
