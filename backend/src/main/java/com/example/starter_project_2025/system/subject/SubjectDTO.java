package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@EqualsAndHashCode(callSuper = false)
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
    @Pattern(
            regexp = "^\\s*$|^(?!\\s*[0-9]+(\\.[0-9]+)?\\s*$).+",
            message = "Technical Group must be text (cannot be only numbers)"
    )
    String technicalGroup;

    @NotNull(groups = OnCreate.class, message = "Duration is required")
    @Min(value = 1, message = "Duration must be greater than 0")
    @Max(value = 1000, message = "Duration (Hours) cannot exceed 1000")
    Integer durationHours;
}
