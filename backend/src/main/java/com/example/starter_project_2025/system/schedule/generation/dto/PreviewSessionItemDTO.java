package com.example.starter_project_2025.system.schedule.generation.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PreviewSessionItemDTO {
    String tempId;
    Long topicId;
    String topicName;
    Integer sessionNumber;

    @JsonFormat(pattern = "yyyy-MM-dd")
    LocalDate date;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    LocalDateTime endTime;

    Long trainerId;
    String trainerName;
    String roomId;

    @Builder.Default
    String status = "VALID"; // VALID, CONFLICT, WARNING

    ConflictDetailDTO conflictDetails;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ConflictDetailDTO {
        String type; // TRAINER_CONFLICT, ROOM_CONFLICT, TIME_OVERLAP
        String conflictingClassCode;
        String message;
    }
}
