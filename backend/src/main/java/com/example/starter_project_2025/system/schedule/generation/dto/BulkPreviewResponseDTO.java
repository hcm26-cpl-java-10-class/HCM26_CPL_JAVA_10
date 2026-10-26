package com.example.starter_project_2025.system.schedule.generation.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.util.List;

@Data
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

    Integer skippedHolidaysCount;

    List<PreviewSessionItemDTO> sessions;

    String correlationId;
}
