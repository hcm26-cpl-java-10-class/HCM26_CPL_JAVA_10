package com.example.starter_project_2025.system.schedule.generation.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
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

    @JsonFormat(pattern = "yyyy-MM-dd")
    LocalDate startDate;

    @JsonFormat(pattern = "yyyy-MM-dd")
    LocalDate estimatedEndDate;

    @Builder.Default
    Integer skippedHolidaysCount = 0;

    @Builder.Default
    List<PreviewSessionItemDTO> sessions = new ArrayList<>();

    String correlationId;
}
