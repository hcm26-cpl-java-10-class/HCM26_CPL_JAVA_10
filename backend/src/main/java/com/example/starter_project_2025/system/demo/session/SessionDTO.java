package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
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

    { setIsActive(true); }

    @NotNull(groups = OnCreate.class, message = "Calendar version ID is required")
    @jakarta.validation.constraints.Positive(groups = {OnCreate.class, OnUpdate.class})
    Long calendarVersionId;

    @JsonProperty(access = READ_ONLY)
    Long classId;

    @NotNull(groups = OnCreate.class, message = "Topic ID is required")
    Long topicId;

    @NotNull(groups = OnCreate.class, message = "Trainer ID is required")
    Long trainerId;

    @NotBlank(groups = OnCreate.class, message = "Title is required")
    @jakarta.validation.constraints.Pattern(regexp = "(?s).*\\S.*", groups = OnUpdate.class)
    @Size(max = 150, message = "Title must not exceed 150 characters", groups = {OnCreate.class, OnUpdate.class})
    String title;

    @NotNull(groups = OnCreate.class, message = "Start time is required")
    LocalDateTime startTime;

    @NotNull(groups = OnCreate.class, message = "End time is required")
    LocalDateTime endTime;

    @Size(max = 150, message = "Location must not exceed 150 characters", groups = {OnCreate.class, OnUpdate.class})
    String location;

    @JsonProperty(access = READ_ONLY)
    Session.SessionStatus status;

    String note;

    @JsonProperty(access = READ_ONLY)
    String cancelReason;
}
