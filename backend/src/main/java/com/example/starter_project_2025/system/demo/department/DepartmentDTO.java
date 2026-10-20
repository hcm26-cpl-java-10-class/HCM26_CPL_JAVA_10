package com.example.starter_project_2025.system.demo.department;

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
public class DepartmentDTO extends BaseDTO {

    @NotBlank(
            groups = OnCreate.class,
            message = "Department name is required"
    )
    @Size(max = 150)
    String name;

    @NotBlank(
            groups = OnCreate.class,
            message = "Department code is required"
    )
    @Size(max = 50)
    String code;

    @Size(max = 500)
    String description;
}