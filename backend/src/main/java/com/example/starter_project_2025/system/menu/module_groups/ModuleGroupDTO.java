package com.example.starter_project_2025.system.menu.module_groups;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import jakarta.validation.constraints.Min;
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
public class ModuleGroupDTO extends BaseDTO {

    @NotBlank(groups = {OnCreate.class, OnUpdate.class}, message = "Module group name is required")
    @Size(max = 100, groups = {OnCreate.class, OnUpdate.class}, message = "Module group name cannot exceed 100 characters")
    String name;

    @Size(max = 500, groups = {OnCreate.class, OnUpdate.class}, message = "Description cannot exceed 500 characters")
    String description;

    @Min(value = 0, groups = {OnCreate.class, OnUpdate.class}, message = "Display order must be greater than or equal to 0")
    Integer displayOrder;
}