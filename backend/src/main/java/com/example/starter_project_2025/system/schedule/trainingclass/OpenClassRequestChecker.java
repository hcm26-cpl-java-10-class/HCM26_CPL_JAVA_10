package com.example.starter_project_2025.system.schedule.trainingclass;

import java.util.List;

public interface OpenClassRequestChecker {

    record CreateOption(
            Long id,
            String label,
            Long programVersionId,
            String programLabel) {
    }

    void validateForCreate(
            Long requestId,
            Long programVersionId);

    List<CreateOption> getCreateOptions();
}