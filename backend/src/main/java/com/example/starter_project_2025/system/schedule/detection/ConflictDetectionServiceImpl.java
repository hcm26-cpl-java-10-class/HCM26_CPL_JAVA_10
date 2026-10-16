package com.example.starter_project_2025.system.schedule.detection;

import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import org.springframework.stereotype.Service;

@Service
public class ConflictDetectionServiceImpl implements ConflictDetectionService {

    @Override
    public ConflictCheckResult checkConflicts(Long calendarVersionId) {
        // TODO: Validate that the requested calendar version exists and is DRAFT.
        // TODO: Load all sessions of the DRAFT and validate their time ranges.
        // TODO: Check each distinct pair within the DRAFT, without duplicate reversed pairs.
        // TODO: Compare with sessions from ACTIVE calendar versions of other classes only.
        // Overlap: startA < endB && endA > startB; touching endpoints do not overlap.
        // A conflict also requires the same trainer or the same non-empty room.
        // TODO: Aggregate all pairs, both conflict types when applicable, and validation errors.
        throw new UnsupportedOperationException(
                "Conflict detection is not implemented yet; calendar entity integration is pending."
        );
    }
}
