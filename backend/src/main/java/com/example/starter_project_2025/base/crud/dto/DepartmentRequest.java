package com.example.starter_project_2025.base.crud.dto;

import com.example.starter_project_2025.base.crud.domain.DepartmentStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class DepartmentRequest {

    @NotBlank(message = "Mã phòng ban không được để trống")
    @Size(max = 50, message = "Mã phòng ban không quá 50 ký tự")
    private String code;

    @NotBlank(message = "Tên phòng ban không được để trống")
    @Size(max = 100, message = "Tên phòng ban không quá 100 ký tự")
    private String name;

    private UUID parentDepartmentId;
    private UUID locationId;

    @NotNull(message = "Trạng thái phòng ban không được để trống")
    private DepartmentStatus status;
}