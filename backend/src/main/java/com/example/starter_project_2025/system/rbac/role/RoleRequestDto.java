package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.AccessLevel;

import java.util.Set;

@Getter
@Setter
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoleRequestDto extends BaseDTO {

    @NotBlank(groups = OnCreate.class, message = "Role name is required")
    @Size(groups = {OnCreate.class, OnUpdate.class}, max = 100,
            message = "Role name must not exceed 100 characters")
    String name;

    @Size(groups = {OnCreate.class, OnUpdate.class}, max = 500,
            message = "Description must not exceed 500 characters")
    String description;

    @NotNull(groups = OnCreate.class, message = "Permission IDs are required")
    Set<Long> permissionIds;

    private boolean isActiveProvided;

    public RoleRequestDto() {
        super.setIsActive(true);
    }

    @Override
    public void setIsActive(Boolean isActive) {
        super.setIsActive(isActive);
        isActiveProvided = true;
    }

    @JsonIgnore
    public boolean isActiveProvided() {
        return isActiveProvided;
    }
}
