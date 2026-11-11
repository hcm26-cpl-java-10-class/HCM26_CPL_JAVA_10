package com.example.starter_project_2025.system.schedule;

import lombok.Getter;

@Getter
public class ScheduleValidationException extends RuntimeException {
    private final ScheduleValidationResult result;
    public ScheduleValidationException(ScheduleValidationResult result) {
        super("The schedule contains validation issues that must be resolved before it can be saved.");
        this.result = result;
    }
}
