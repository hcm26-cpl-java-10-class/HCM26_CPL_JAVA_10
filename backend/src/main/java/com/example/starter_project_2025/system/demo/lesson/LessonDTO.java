package com.example.starter_project_2025.system.demo.lesson;

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
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LessonDTO extends BaseDTO {

    public LessonDTO() {
        setIsActive(true);
    }

    @NotNull(groups = OnCreate.class, message = "Section ID is required")
    Long sectionId;

    @NotBlank(groups = OnCreate.class, message = "Lesson title is required")
    @Size(max = 200, groups = {OnCreate.class, OnUpdate.class},
            message = "Title must not exceed 200 characters")
    String title;

    @NotNull(groups = OnCreate.class, message = "Content type is required")
    LessonContentType contentType;

    @Size(max = 500, groups = {OnCreate.class, OnUpdate.class},
            message = "Content URL must not exceed 500 characters")
    String contentUrl;

    String textContent;

    @Min(value = 0, groups = {OnCreate.class, OnUpdate.class},
            message = "Duration must not be negative")
    Integer duration;

    @NotNull(groups = OnCreate.class, message = "Order index is required")
    @Min(value = 0, groups = {OnCreate.class, OnUpdate.class},
            message = "Order index must not be negative")
    Integer orderIndex;
}
