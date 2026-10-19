package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class StudySessionDTO extends BaseDTO {

    @NotNull(groups = OnCreate.class, message = "Class ID is required")
    Long classId;

    @NotNull(groups = OnCreate.class, message = "Subject ID is required")
    Long subjectId;

    @NotNull(groups = OnCreate.class, message = "Teacher ID is required")
    Long teacherId;

    @NotBlank(groups = OnCreate.class, message = "Study session title is required")
    @Size(max = 200, message = "Title must not exceed 200 characters")
    String title;

    @NotNull(groups = OnCreate.class, message = "Start time is required")
    LocalDateTime startTime;

    @NotNull(groups = OnCreate.class, message = "End time is required")
    LocalDateTime endTime;

    @Size(max = 100, message = "Room must not exceed 100 characters")
    String room;

    @Size(max = 500, message = "Online link must not exceed 500 characters")
    String onlineLink;
}