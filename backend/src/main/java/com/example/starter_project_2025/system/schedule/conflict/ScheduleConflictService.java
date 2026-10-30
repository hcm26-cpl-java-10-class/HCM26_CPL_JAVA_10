package com.example.starter_project_2025.system.schedule.conflict;

import com.example.starter_project_2025.system.schedule.conflict.dto.ScheduleValidationRequest;
import com.example.starter_project_2025.system.schedule.conflict.dto.ScheduleValidationResponse;

public interface ScheduleConflictService {

    ScheduleValidationResponse validateCandidates(Long versionId, ScheduleValidationRequest request);
}
