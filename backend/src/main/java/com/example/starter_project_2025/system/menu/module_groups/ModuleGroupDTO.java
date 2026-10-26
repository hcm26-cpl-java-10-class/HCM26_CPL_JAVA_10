package com.example.starter_project_2025.system.menu.module_groups;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.groups.Default;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ModuleGroupDTO extends BaseDTO {

    @NotBlank(message = "Module group name is required", groups = {Default.class, OnCreate.class, OnUpdate.class})
    @Size(max = 100, groups = {Default.class, OnCreate.class, OnUpdate.class})
    String name;

    @Size(max = 500, groups = {Default.class, OnCreate.class, OnUpdate.class})
    String description;

    Integer displayOrder;
}
