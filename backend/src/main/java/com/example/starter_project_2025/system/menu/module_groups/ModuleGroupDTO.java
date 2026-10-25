package com.example.starter_project_2025.system.menu.module_groups;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
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

    @NotBlank(message = "Module group name is required")
    @Size(max = 100)
    String name;

    @Size(max = 500)
    String description;

    Integer displayOrder;
}