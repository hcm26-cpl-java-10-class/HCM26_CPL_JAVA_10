package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.exception.ConflictException;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
public class TrainingClassConflictException extends ConflictException {
    private final Map<String, List<String>> errors;
    private final Long currentVersion;

    public TrainingClassConflictException(String message,
                                         Map<String, List<String>> errors,
                                         Long currentVersion) {
        super(message);
        this.errors = errors;
        this.currentVersion = currentVersion;
    }

    public static TrainingClassConflictException duplicateCode() {
        String message = "Class code already exists";
        return new TrainingClassConflictException(
                message, Map.of("code", List.of(message)), null);
    }
}
