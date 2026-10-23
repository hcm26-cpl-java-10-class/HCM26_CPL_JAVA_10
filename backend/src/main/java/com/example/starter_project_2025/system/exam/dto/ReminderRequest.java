package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.system.exam.domain.ReminderType;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class ReminderRequest {

    @NotNull(groups = OnCreate.class, message = "Reminder type is required")
    private ReminderType reminderType;

    private LocalDateTime scheduledAt;

    private Long invitationId;
}
