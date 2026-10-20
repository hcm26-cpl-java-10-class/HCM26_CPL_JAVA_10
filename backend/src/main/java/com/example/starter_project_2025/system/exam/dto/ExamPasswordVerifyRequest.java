package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExamPasswordVerifyRequest {

    @NotBlank(message = "Mật khẩu không được để trống")
    private String password;
}
