package com.example.starter_project_2025.system.class_setup.dto;

import com.example.starter_project_2025.system.class_setup.ClassStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record TrainingClassRequest(
        @NotBlank(message = "Mã lớp không được để trống")
        @Size(max = 50, message = "Mã lớp tối đa 50 ký tự")
        String code,

        @NotBlank(message = "Tên lớp không được để trống")
        @Size(max = 150, message = "Tên lớp tối đa 150 ký tự")
        String name,

        Long programId,

        LocalDate startDate,

        LocalDate endDate,

        ClassStatus status,

        Integer plannedSize
) {}
