
package com.example.trainingprogram.dto;

import com.example.trainingprogram.entity.ProgramStatus;

import java.time.Instant;
import java.util.List;

public record TrainingProgramResponse(
    Long id,
    String code,
    String name,
    String version,
    String region,
    ProgramStatus status,
    int subjectCount,
    int totalDurationHours,
    List<ProgramSubjectResponse> subjects,
    Instant createdAt,
    Instant updatedAt
) {

    public record ProgramSubjectResponse(
        Long subjectId,
        String subjectCode,
        String subjectName,
        int durationHours,
        int orderIndex
    ) {}
}
