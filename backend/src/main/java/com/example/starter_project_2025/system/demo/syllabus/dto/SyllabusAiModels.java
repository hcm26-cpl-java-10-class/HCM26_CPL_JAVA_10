package com.example.starter_project_2025.system.demo.syllabus.dto;

import java.util.List;

/** API contract for AI-assisted drafting. No database IDs are included in the preview. */
public final class SyllabusAiModels {
    private SyllabusAiModels() {}

    public record Status(boolean configured) {}

    public record GenerateRequest(
            String code, String name, String focus, String degreeLevel,
            String language, Integer sectionCount, Integer topicsPerSection,
            Integer cloCount, String notes
    ) {}

    /** CLO numbers are 1-based positions in {@link Draft#clos()}, NOT database IDs. */
    public record TopicDraft(String title, List<Integer> cloNumbers) {}

    public record SectionDraft(String title, String mission, List<TopicDraft> topics) {}

    /** Material suggestions start unselected with no URL; only reviewed linked items are persisted. */
    public record MaterialDraft(
            String title, String type, String url, String author,
            String publisher, boolean mainMaterial, String note,
            Integer sectionIndex, Integer topicIndex, boolean include
    ) {}

    public record Draft(
            String code, String name, String description,
            String teachingMethods, String degreeLevel, String timeAllocation,
            String studentResponsibilities, String requiredTools, Integer scoringScale,
            List<String> clos, List<SectionDraft> sections, List<MaterialDraft> materials
    ) {}

    public record SaveResult(Long id, int savedMaterialCount) {}
}
