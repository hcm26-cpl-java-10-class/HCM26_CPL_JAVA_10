package com.example.starter_project_2025.system.project.milestone.dto.request;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record MilestoneDraftRequest(Long teamId, String title, String description, Instant deadline,
        Boolean mandatory, UUID rubricSnapshotId, LatePolicyType latePolicyType, Instant lateUntil,
        BigDecimal latePenaltyPercent, Boolean allowResubmission, Integer maxSubmissionAttempts,
        BigDecimal weight, List<ChecklistItemRequest> checklist, Long expectedVersion) { }
