package com.example.starter_project_2025.system.schedule.session.dto;

import jakarta.validation.constraints.Pattern;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import jakarta.validation.constraints.Positive;
import org.hibernate.validator.constraints.URL;
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

    { setIsActive(true); }

    @NotNull(groups = OnCreate.class, message = "Calendar version ID is required")
    @Positive
    Long calendarVersionId;

    @NotNull(groups = OnCreate.class, message = "Topic ID is required")
    @Positive
    Long topicId;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Integer calendarVersionNumber;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    String calendarVersionStatus;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Long classId;

    @Size(max = 60, message = "Class code must not exceed 60 characters")
    String classCode;

    @Size(max = 120, message = "Topic name must not exceed 120 characters")
    String topicName;

    @NotNull(groups = OnCreate.class, message = "Trainer ID is required")
    @Positive
    Long trainerId;

    @Size(max = 100, message = "Trainer name must not exceed 100 characters")
    String trainerName;

    @NotBlank(groups = OnCreate.class, message = "Title is required")
    @Pattern(regexp = "(?s).*\\S.*", groups = OnUpdate.class)
    @Size(max = 150, message = "Title must not exceed 150 characters")
    String title;

    @NotNull(groups = OnCreate.class, message = "Start time is required")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    LocalDateTime startTime;

    @NotNull(groups = OnCreate.class, message = "End time is required")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    LocalDateTime endTime;

    @Size(max = 80, message = "Room must not exceed 80 characters")
    @com.fasterxml.jackson.annotation.JsonAlias("location")
    String room;

    @Size(max = 255, message = "Meeting link must not exceed 255 characters")
    @URL(regexp = "https?://.+")
    String meetingLink;

    SessionStatus status;

    @com.fasterxml.jackson.annotation.JsonAlias("note")
    String notes;

    @Size(max = 500, message = "Cancel reason must not exceed 500 characters")
    String cancelReason;

    Boolean isOverridden;

    String overrideReason;

    Boolean forceOverride;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Long version;
}
