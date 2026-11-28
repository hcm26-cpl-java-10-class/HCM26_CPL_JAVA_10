package com.example.starter_project_2025.system.demo.coursepolicy;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public final class CoursePolicyDTO {

    private CoursePolicyDTO() {
    }

    public record CompletionRuleResponse(int minLessonPercent, boolean requireAssessmentsPass, boolean customized) {
    }

    public record CompletionRuleRequest(
            @NotNull @Min(1) @Max(100) Integer minLessonPercent,
            @NotNull Boolean requireAssessmentsPass
    ) {
    }

    /** met = the current user already completed this course (holds its certificate). */
    public record PrerequisiteItem(Long courseId, String courseName, boolean met) {
    }

    public record AddPrerequisiteRequest(@NotNull Long prerequisiteCourseId) {
    }
}
