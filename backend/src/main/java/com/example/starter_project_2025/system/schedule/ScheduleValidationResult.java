package com.example.starter_project_2025.system.schedule;

import java.util.List;

public record ScheduleValidationResult(boolean valid, String timezone, List<ScheduleIssue> issues) {}
