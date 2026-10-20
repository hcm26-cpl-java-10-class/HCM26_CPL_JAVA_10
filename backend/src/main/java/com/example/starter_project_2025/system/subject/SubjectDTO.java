package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
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
public class SubjectDTO extends BaseDTO {

    SubjectStatus status;

    @NotBlank(groups = OnCreate.class, message = "Subject code is required")
    @Size(max = 50, message = "Subject code must not exceed 50 characters")
    String code;

    @NotBlank(groups = OnCreate.class, message = "Subject name is required")
    @Size(max = 255, message = "Subject name must not exceed 255 characters")
    String name;

    @NotBlank(groups = OnCreate.class, message = "Version is required")
    @Size(max = 20, message = "Version must not exceed 20 characters")
    String version;

    @Size(max = 1000, message = "Description must not exceed 1000 characters")
    String description;

    @Size(max = 100, message = "Technical group must not exceed 100 characters")
    String technicalGroup;

    @NotNull(groups = OnCreate.class, message = "Duration is required")
    @Min(value = 1, message = "Duration must be greater than 0")
    Integer durationHours;
}
