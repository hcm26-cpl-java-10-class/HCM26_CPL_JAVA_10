package com.example.starter_project_2025.system.schedule.generation.dto;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkPreviewResponseDTO {
    Long classId;
    Integer totalSessions;
    Double totalHoursCalculated;
    Boolean hasConflicts;
    Integer conflictCount;

    @Builder.Default
    List<PreviewSessionItemDTO> sessions = new ArrayList<>();

    String correlationId;
}
