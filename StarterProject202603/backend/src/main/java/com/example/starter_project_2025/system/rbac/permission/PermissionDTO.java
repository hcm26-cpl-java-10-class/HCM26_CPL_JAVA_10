package com.example.starter_project_2025.system.rbac.permission;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PermissionDTO extends BaseDTO {

    @NotBlank(groups = OnCreate.class, message = "Permission name is required")
    @Size(max = 100, message = "Name must not exceed 100 characters")
    String name;

    @Size(max = 255, message = "Description must not exceed 255 characters")
    String description;

    @NotBlank(groups = OnCreate.class, message = "Resource is required")
    @Size(max = 50, message = "Resource must not exceed 50 characters")
    String resource;

    @NotBlank(groups = OnCreate.class, message = "Action is required")
    @Size(max = 50, message = "Action must not exceed 50 characters")
    String action;
}
