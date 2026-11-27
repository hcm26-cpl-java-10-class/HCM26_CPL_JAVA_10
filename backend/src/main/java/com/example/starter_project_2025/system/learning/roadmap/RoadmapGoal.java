package com.example.starter_project_2025.system.learning.roadmap;

import com.example.starter_project_2025.system.demo.course.CourseLevel;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;

public record RoadmapGoal(
        @NotBlank @Size(max = 150) String careerGoal,
        @NotNull CourseLevel currentLevel,
        @NotNull @Min(1) @Max(40) Integer hoursPerWeek,
        @Min(1) @Max(12) Integer durationMonths,
        @Min(1) @Max(48) Integer durationWeeks
) {
    public RoadmapGoal(String careerGoal, CourseLevel currentLevel, Integer hoursPerWeek, Integer durationMonths) {
        this(careerGoal, currentLevel, hoursPerWeek, durationMonths, null);
    }

    @AssertTrue(message = "Enter a target duration")
    public boolean isDurationSpecified() {
        return durationWeeks != null || durationMonths != null;
    }

    public int targetWeeks() {
        return durationWeeks != null ? durationWeeks : durationMonths * 4;
    }
}
