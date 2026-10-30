package com.example.starter_project_2025.system.schedule.conflict.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SessionCandidateRequest {

    @NotBlank(message = "A candidate key is required for each session.")
    @Size(max = 100, message = "The candidate key must not exceed 100 characters.")
    String candidateKey;

    Long sessionId;

    @NotNull(message = "Select a class.")
    @Positive(message = "The class ID must be a positive number.")
    Long classId;

    @NotNull(message = "Select an instructor.")
    @Positive(message = "The instructor ID must be a positive number.")
    Long trainerId;

    @Positive(message = "The subject ID must be a positive number.")
    Long topicId;

    @Positive(message = "The teaching assignment ID must be a positive number.")
    Long teachingAssignmentId;

    @Size(max = 150, message = "The session title must not exceed 150 characters.")
    String title;

    @NotNull(message = "A start date and time are required.")
    LocalDateTime startAt;

    @NotNull(message = "An end date and time are required.")
    LocalDateTime endAt;

    @Positive(message = "The room ID must be a positive number.")
    Long roomId;

    @Size(max = 150, message = "The room name must not exceed 150 characters.")
    String location;

    @Size(max = 500, message = "The meeting URL must not exceed 500 characters.")
    String meetingUrl;
}
