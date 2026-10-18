package com.example.starter_project_2025.base.crud.dto;

import com.example.starter_project_2025.base.crud.domain.DepartmentStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.List;
import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class DepartmentDTO extends BaseDTO {

    @NotBlank(message = "Mã phòng ban không được để trống", groups = {OnCreate.class, OnUpdate.class})
    @Size(max = 50, message = "Mã phòng ban không quá 50 ký tự", groups = {OnCreate.class, OnUpdate.class})
    private String code;

    @NotBlank(message = "Tên phòng ban không được để trống", groups = {OnCreate.class, OnUpdate.class})
    @Size(max = 100, message = "Tên phòng ban không quá 100 ký tự", groups = {OnCreate.class, OnUpdate.class})
    private String name;

    private UUID parentDepartmentId;
    private String parentDepartmentName;
    private UUID locationId;

    @NotNull(message = "Trạng thái không được để trống", groups = {OnCreate.class, OnUpdate.class})
    private DepartmentStatus status;

    private List<DepartmentDTO> children;
}