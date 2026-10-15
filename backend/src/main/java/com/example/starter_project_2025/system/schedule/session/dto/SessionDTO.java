package com.example.starter_project_2025.system.schedule.session.dto;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
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
public class SessionDTO extends BaseDTO {

    @NotNull(groups = OnCreate.class, message = "Calendar version ID is required")
    Long calendarVersionId;

    @NotNull(groups = OnCreate.class, message = "Topic ID is required")
    Long topicId;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    String classCode;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    String topicName;

    @NotNull(groups = OnCreate.class, message = "Trainer ID is required")
    Long trainerId;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    String trainerName;

    @NotBlank(groups = OnCreate.class, message = "Title is required")
    @Size(max = 150, message = "Title must not exceed 150 characters")
    String title;

    @NotNull(groups = OnCreate.class, message = "Start time is required")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    LocalDateTime startTime;

    @NotNull(groups = OnCreate.class, message = "End time is required")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    LocalDateTime endTime;

    @Size(max = 80, message = "Room must not exceed 80 characters")
    String room;

    @Size(max = 255, message = "Meeting link must not exceed 255 characters")
    String meetingLink;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    SessionStatus status;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    String notes;
}
