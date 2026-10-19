package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class StudySessionDTO extends BaseDTO {

    @NotNull(groups = OnCreate.class, message = "Subject ID is required")
    Long subjectId;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    String subjectName;

    @NotBlank(groups = OnCreate.class, message = "Study session title is required")
    @Pattern(regexp = StudySessionValidator.TITLE_NONBLANK_PATTERN, groups = {OnCreate.class, OnUpdate.class},
            message = "Study session title must not be blank")
    @Size(min = 5, max = 150, groups = {OnCreate.class, OnUpdate.class},
            message = "Title must contain between 5 and 150 characters")
    String title;

    @NotNull(groups = OnCreate.class, message = "Session date is required")
    LocalDate sessionDate;

    @NotNull(groups = OnCreate.class, message = "Start time is required")
    LocalTime startTime;

    @NotNull(groups = OnCreate.class, message = "End time is required")
    LocalTime endTime;

    @Size(max = 30, groups = {OnCreate.class, OnUpdate.class},
            message = "Room must not exceed 30 characters")
    @Pattern(regexp = StudySessionValidator.ROOM_PATTERN, groups = {OnCreate.class, OnUpdate.class},
            message = "Room must contain letters, numbers, spaces or common separators and must not be blank")
    String room;

    @NotBlank(groups = OnCreate.class, message = "Lecturer is required")
    @Size(min = 2, max = 100, groups = {OnCreate.class, OnUpdate.class},
            message = "Lecturer must contain between 2 and 100 characters")
    @Pattern(regexp = StudySessionValidator.LECTURER_PATTERN, groups = {OnCreate.class, OnUpdate.class},
            message = "Lecturer must include a letter and may contain letters, numbers, spaces or common name punctuation")
    String lecturer;

    @NotNull(groups = OnCreate.class, message = "Study session type is required")
    StudySessionType type;

    @Size(max = 500, groups = {OnCreate.class, OnUpdate.class},
            message = "Description must not exceed 500 characters")
    String description;

    @Size(max = 1000, message = "Notes must not exceed 1000 characters")
    String notes;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    SessionStatus status;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    String cancelReason;
}
