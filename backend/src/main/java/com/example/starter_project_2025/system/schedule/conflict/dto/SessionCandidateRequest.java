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

    @NotBlank
    @Size(max = 100)
    String candidateKey;

    Long sessionId;

    @NotNull
    @Positive
    Long classId;

    @NotNull
    @Positive
    Long trainerId;

    @NotNull
    LocalDateTime startAt;

    @NotNull
    LocalDateTime endAt;

    @Positive
    Long roomId;

    @Size(max = 150)
    String location;

    @Size(max = 500)
    String meetingUrl;
}
