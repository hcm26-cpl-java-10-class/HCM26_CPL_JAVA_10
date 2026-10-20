package com.example.starter_project_2025.system.schedule.conflict_resolution.repository;

import com.example.starter_project_2025.system.schedule.conflict_resolution.ScheduleConflictResolutionAuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ScheduleConflictResolutionAuditRepository
        extends JpaRepository<ScheduleConflictResolutionAuditEvent, Long> {

    List<ScheduleConflictResolutionAuditEvent> findByResolution_IdOrderByOccurredAtAsc(Long resolutionId);
}
