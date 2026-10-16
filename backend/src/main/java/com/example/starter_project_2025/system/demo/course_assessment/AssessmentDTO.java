package com.example.starter_project_2025.system.demo.course_assessment;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AssessmentDTO extends BaseDTO {
    @NotNull(groups = OnCreate.class, message = "Course is required")
    Long courseId;

    String courseName;

    @NotBlank(groups = OnCreate.class, message = "Assessment name is required")
    @Size(max = 255, message = "Name must not exceed 255 characters")
    String name;

    @Size(max = 255, message = "Description must not exceed 255 characters")
    String description;

    @NotNull(groups = OnCreate.class, message = "Assessment type is required")
    AssessmentType type;

    @Min(value = 1, message = "Time limit must be at least 1 minute")
    Integer timeLimit;

    @Min(value = 1, message = "Max attempts must be at least 1")
    Integer maxAttempt;

    LocalDateTime dueAt;
}
