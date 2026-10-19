package com.example.starter_project_2025.system.schedule.generation.dto;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkSaveSessionsResponseDTO {
    Long calendarVersionId;
    Long classId;
    Integer createdCount;
    String status; // SAVED_TO_DRAFT
    String message;
    LocalDateTime createdAt;
    String correlationId;
}
