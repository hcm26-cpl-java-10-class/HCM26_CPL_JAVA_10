package com.example.starter_project_2025.system.class_setup.dto;

import com.example.starter_project_2025.system.class_setup.ClassStatus;
import com.example.starter_project_2025.system.class_setup.TrainingClass;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record TrainingClassResponse(
        Long id,
        String code,
        String name,
        Long programId,
        String programCode,
        String programName,
        Integer programVersion,
        LocalDate startDate,
        LocalDate endDate,
        ClassStatus status,
        Integer plannedSize,
        Boolean isActive,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static TrainingClassResponse from(TrainingClass c, String programCode, String programName, Integer programVersion) {
        return new TrainingClassResponse(
                c.getId(),
                c.getCode(),
                c.getName(),
                c.getProgramId(),
                programCode,
                programName,
                programVersion,
                c.getStartDate(),
                c.getEndDate(),
                c.getStatus(),
                c.getPlannedSize(),
                c.getIsActive(),
                c.getCreatedAt(),
                c.getUpdatedAt()
        );
    }
}
