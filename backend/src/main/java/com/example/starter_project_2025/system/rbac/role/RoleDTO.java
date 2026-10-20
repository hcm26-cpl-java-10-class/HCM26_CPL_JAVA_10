package com.example.starter_project_2025.system.rbac.role;

<<<<<<< Updated upstream
import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.constraints.NotBlank;
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

    Boolean isSystem;

    Boolean isActive;

    Long userCount;
=======
import lombok.NoArgsConstructor;

@NoArgsConstructor
public class RoleDTO extends RoleRequestDto {
>>>>>>> Stashed changes
}
