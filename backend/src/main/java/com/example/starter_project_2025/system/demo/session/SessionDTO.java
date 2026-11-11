package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SessionDTO extends BaseDTO {

    @NotNull(groups = OnCreate.class, message = "Class ID is required")
    Long classId;

    @NotNull(groups = OnCreate.class, message = "Topic ID is required")
    Long topicId;

    @NotNull(groups = OnCreate.class, message = "Trainer ID is required")
    Long trainerId;

    Long teachingAssignmentId;

    Long roomId;

    @Size(max = 1000, message = "The meeting URL must not exceed 1,000 characters.")
    String meetingUrl;

    @NotBlank(groups = OnCreate.class, message = "Title is required")
    @Size(max = 150, message = "Title must not exceed 150 characters")
    String title;

    @NotNull(groups = OnCreate.class, message = "Start time is required")
    LocalDateTime startTime;

    @NotNull(groups = OnCreate.class, message = "End time is required")
    LocalDateTime endTime;

    @Size(max = 150, message = "Location must not exceed 150 characters")
    String location;

    @JsonProperty(access = READ_ONLY)
    Session.SessionStatus status;

    String note;

    @JsonProperty(access = READ_ONLY)
    String cancelReason;
}
