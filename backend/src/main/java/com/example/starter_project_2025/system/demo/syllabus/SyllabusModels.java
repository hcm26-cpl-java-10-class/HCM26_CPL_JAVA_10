package com.example.starter_project_2025.system.demo.syllabus;

import java.util.List;

public final class SyllabusModels {

    private SyllabusModels() {
    }

    public record SyllabusInput(
            String code,
            String name,
            String description
    ) {
    }

    public record SectionInput(
            String title,
            Integer orderIndex,
            String mission
    ) {
    }

    public record BulkSectionInput(
            List<String> titles
    ) {
    }

    public record TopicInput(
            String title,
            Integer orderIndex
    ) {
    }

    public record Summary(
            Long id,
            String code,
            String name,
            String description,
            long sectionCount,
            boolean isActive,
            String status,
            int completionPercent
    ) {}

    public record TopicView(
            Long id,
            String title,
            Integer orderIndex
    ) {
    }

    public record SectionView(
            Long id,
            String title,
            Integer orderIndex,
            String mission,
            List<TopicView> topics
    ) {
    }

    public record Detail(
            Long id,
            String code,
            String name,
            String description,
            List<SectionView> sections,
            boolean isActive,
            String status,
            int completionPercent
    ) {}

    public record ValidationResult(
            boolean valid,
            List<String> errors
    ) {
    }

    public record InformationInput(
            String code,
            String name,
            String description,
            String teachingMethods,
            String degreeLevel,
            String timeAllocation,
            String studentResponsibilities,
            String requiredTools,
            Integer scoringScale
    ) {
    }

    public record InformationView(
            Long id,
            String code,
            String name,
            String description,
            String teachingMethods,
            String degreeLevel,
            String timeAllocation,
            String studentResponsibilities,
            String requiredTools,
            Integer scoringScale
    ) {
    }



}