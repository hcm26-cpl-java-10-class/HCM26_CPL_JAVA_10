package com.example.starter_project_2025.system.demo.online_lession;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LessonDTO extends BaseDTO {

    @NotBlank(groups = OnCreate.class, message = "Lesson title is required")
    @Size(max = 200, message = "Title must not exceed 200 characters")
    String title;

    @Size(max = 1000, message = "Description must not exceed 1000 characters")
    String description;

    @Size(max = 500, message = "Video URL must not exceed 500 characters")
    String videoUrl;

    @Min(value = 0, message = "Duration must not be negative")
    Integer durationMinutes;

    @NotNull(groups = OnCreate.class, message = "Order is required")
    @Min(value = 1, message = "Order must be at least 1")
    Integer orderIndex;

    @NotNull(groups = OnCreate.class, message = "Course is required")
    Long courseId;

    @JsonProperty(access = READ_ONLY)
    String courseName;
}
