
package com.example.starter_project_2025.system.demo.section;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import jakarta.validation.constraints.Min;
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
public class SectionDTO extends BaseDTO {

    @NotNull(
            groups = OnCreate.class,
            message = "Course ID is required"
    )
    Long courseId;

    @NotBlank(
            groups = OnCreate.class,
            message = "Section title is required"
    )
    @Size(
            max = 150,
            groups = {OnCreate.class, OnUpdate.class},
            message = "Title must not exceed 150 characters"
    )
    String title;

    @NotNull(
            groups = OnCreate.class,
            message = "Order index is required"
    )
    @Min(
            value = 0,
            groups = {OnCreate.class, OnUpdate.class},
            message = "Order index must not be negative"
    )
    Integer orderIndex;
}
