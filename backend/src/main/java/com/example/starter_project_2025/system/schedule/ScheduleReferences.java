package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.system.external_api.dto.*;
import java.time.LocalDate;
import java.util.List;

/** Read-only contract with the owners of classes, assignments and shared catalogues. */
public record ScheduleReferences(List<ExternalClassDTO> classes, List<ExternalTrainerDTO> trainers,
        List<ExternalRoomDTO> rooms, List<Assignment> assignments, List<Holiday> holidays) {
    public record Assignment(Long id, Long classId, Long topicId, Long trainerId,
            LocalDate effectiveFrom, LocalDate effectiveTo, String status) {}
    public record Holiday(LocalDate date, LocalDate endDate, String name) {}
}
