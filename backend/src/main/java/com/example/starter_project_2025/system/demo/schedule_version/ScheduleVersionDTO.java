package com.example.starter_project_2025.system.demo.schedule_version;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
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
public class ScheduleVersionDTO extends BaseDTO {

    @NotNull(groups = OnCreate.class, message = "Class ID is required")
    Long classId;

    @NotNull(groups = OnCreate.class, message = "Version number is required")
    Integer versionNumber;

    @Size(max = 30, message = "Status must not exceed 30 characters")
    String status;

    @Size(max = 500, message = "Note must not exceed 500 characters")
    String note;

    LocalDateTime activatedAt;
}
