package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.system.exam.domain.ReminderStatus;
import com.example.starter_project_2025.system.exam.domain.ReminderType;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter
@Setter
public class ReminderDTO extends BaseDTO {

    @NotNull(groups = OnCreate.class)
    private Long examId;

    private Long invitationId;

    @JsonProperty(access = READ_ONLY)
    private String examTitle;

    @JsonProperty(access = READ_ONLY)
    private String userEmail;

    @JsonProperty(access = READ_ONLY)
    private String userFullName;

    @NotNull(groups = OnCreate.class, message = "Reminder type is required")
    private ReminderType reminderType;

    @NotNull(groups = OnCreate.class, message = "Scheduled time is required")
    private LocalDateTime scheduledAt;

    @JsonProperty(access = READ_ONLY)
    private LocalDateTime sentAt;

    @JsonProperty(access = READ_ONLY)
    private ReminderStatus status;

    @JsonProperty(access = READ_ONLY)
    private Integer sendAttempts;

    @JsonProperty(access = READ_ONLY)
    private String lastError;

    private Boolean isActive;
}
