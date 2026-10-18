package com.example.starter_project_2025.system.demo.course;

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
public class CourseDTO extends BaseDTO {

    @NotBlank(groups = OnCreate.class, message = "Course name is required")
    @Size(max = 150, message = "Name must not exceed 150 characters")
    String name;

    @Size(max = 500, message = "Description must not exceed 500 characters")
    String description;

    @Size(max = 255, message = "Thumbnail URL must not exceed 255 characters")
    String thumbnailUrl;

    @Size(max = 100, message = "Instructor must not exceed 100 characters")
    String instructor;

    Long instructorId;

    Long categoryId;

    String categoryName;

    CourseStatus status;

    Boolean isFree;

    CourseLevel level;
}
