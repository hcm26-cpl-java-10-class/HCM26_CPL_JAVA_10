package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
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

    Long calendarVersionId;
    Long topicId;

    @NotBlank(groups = OnCreate.class, message = "Class code is required")
    @Size(max = 60, message = "Class code must not exceed 60 characters")
    String classCode;

    @Size(max = 120, message = "Topic name must not exceed 120 characters")
    String topicName;

    @NotNull(groups = OnCreate.class, message = "Trainer ID is required")
    Long trainerId;

    @NotBlank(groups = OnCreate.class, message = "Trainer name is required")
    @Size(max = 100, message = "Trainer name must not exceed 100 characters")
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

    SessionStatus status;

    String notes;

    @Size(max = 500, message = "Cancel reason must not exceed 500 characters")
    String cancelReason;

    Boolean isOverridden;

    String overrideReason;

    // Field hỗ trợ request override từ Client (BR-10)
    Boolean forceOverride;

    /**
     * Phiên bản lạc hậu (optimistic locking) — chỉ trả về trong response, không nhận từ client.
     */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Long version;
}
