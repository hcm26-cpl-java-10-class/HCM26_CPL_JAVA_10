package com.example.starter_project_2025.system.schedule.generation.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PreviewSessionItemDTO {

    String tempId;

    Long topicId;
    Long programSubjectId;
    Long subjectId;

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

    Long roomId;

    String roomName;
    String meetingUrl;

    Long teachingAssignmentId;

    String title;

    @Builder.Default
    String status = "VALID";

    ConflictDetailDTO conflictDetails;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ConflictDetailDTO {
        String type;
        String conflictingClassCode;
        String message;
    }
}
