package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.data.domain.Page;
import java.time.LocalDate;
import java.util.List;

public record TeachingAssignmentImpactResponse(boolean canSave, Long revision, long linkedSessionCount,
        long affectedSessionCount, LocalDate effectiveFrom, LocalDate effectiveTo, Page<SessionImpact> affectedSessions) {
    public record SessionImpact(TeachingAssignmentSessionResponse session, List<String> reasons) {}
}
