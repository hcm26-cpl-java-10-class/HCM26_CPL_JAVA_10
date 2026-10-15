package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.fasterxml.jackson.annotation.JsonProperty;
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
    @NotBlank(
            groups = OnUpdate.class,
            message = "Study session title must not be blank"
    )
    @Size(max = 200, message = "Title must not exceed 200 characters")
    String title;

    @NotNull(groups = OnCreate.class, message = "Session date is required")
    LocalDate sessionDate;

    @NotNull(groups = OnCreate.class, message = "Start time is required")
    LocalTime startTime;

    @NotNull(groups = OnCreate.class, message = "End time is required")
    LocalTime endTime;

    @Size(max = 100, message = "Room must not exceed 100 characters")
    String room;

    @Size(max = 150, message = "Lecturer must not exceed 150 characters")
    String lecturer;

    @NotNull(groups = OnCreate.class, message = "Study session type is required")
    StudySessionType type;

    @Size(max = 1000, message = "Description must not exceed 1000 characters")
    String description;

    @Size(max = 1000, message = "Notes must not exceed 1000 characters")
    String notes;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    SessionStatus status;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    String cancelReason;
}