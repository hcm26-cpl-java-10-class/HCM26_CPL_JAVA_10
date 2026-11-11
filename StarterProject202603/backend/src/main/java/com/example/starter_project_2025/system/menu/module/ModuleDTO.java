package com.example.starter_project_2025.system.menu.module;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ModuleDTO extends BaseDTO {

    @NotNull(message = "Module group id is required")
    Long moduleGroupId;

    @NotBlank(message = "Title is required")
    @Size(max = 100)
    String title;

    @Size(max = 500)
    String url;

    @Size(max = 50)
    String icon;

    @Size(max = 500)
    String description;

    Integer displayOrder;

    String requiredPermission;
}