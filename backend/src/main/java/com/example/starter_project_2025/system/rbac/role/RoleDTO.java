package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
 feature/permission
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import jakarta.validation.constraints.NotBlank;
 dev
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.Set;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoleDTO extends BaseDTO {

    @NotBlank(groups = OnCreate.class, message = "Role name is required")
    @Size(max = 100, message = "Name must not exceed 100 characters")
    String name;

    @Size(max = 255, message = "Description must not exceed 255 characters")
    String description;

    Set<Long> permissionIds;

 feature/permission
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Boolean isSystem;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)

    Boolean isSystem;

    Boolean isActive;

 dev
    Long userCount;
}
