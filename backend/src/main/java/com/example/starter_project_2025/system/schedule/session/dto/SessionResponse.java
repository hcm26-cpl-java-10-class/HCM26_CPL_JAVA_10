package com.example.starter_project_2025.system.schedule.session.dto;

import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SessionResponse {
    Long id;
    Long calendarVersionId;
    Long calendarVersionNumber;
    String calendarVersionStatus;
    Long classId;
    String classCode;
    String title;
    Long topicId;
    String topicName;
    Long trainerId;
    String trainerName;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    LocalDateTime endTime;

    String room;
    String meetingLink;
    SessionStatus status;
    String notes;
    String cancelReason;
    Long version;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    LocalDateTime createdAt;

    Long createdBy;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    LocalDateTime updatedAt;

    Long updatedBy;
}
