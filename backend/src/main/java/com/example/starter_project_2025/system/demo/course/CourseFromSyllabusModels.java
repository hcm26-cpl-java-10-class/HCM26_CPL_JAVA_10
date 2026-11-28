package com.example.starter_project_2025.system.demo.course;

import java.util.List;
import com.example.starter_project_2025.system.exam.core.dto.ExamDTO;

/** Contracts for previewing and customizing a Course before any database writes. */
public final class CourseFromSyllabusModels {
    private CourseFromSyllabusModels() {}

    public record SourceTopic(Long id, String title) {}

    public record SourceSection(Long id, String title, String mission, List<SourceTopic> topics) {}

    public record Preview(Long syllabusId, String syllabusCode, String syllabusName,
                          String syllabusDescription, List<SourceSection> sections) {}

    /** Suggested display name is never reserved; creation always rechecks uniqueness. */
    public record NameSuggestion(String name, int sequence) {}

    public record NameAvailability(boolean available) {}

    /** Section and Lesson titles are deliberately independent copies of the source. */
    /** sourceTopicIds are aligned by index with lessons; null = manually added Lesson. */
    public record DraftSection(String title, List<String> lessons, List<Long> sourceTopicIds,
                               List<String> lessonMaterials,
                               List<com.example.starter_project_2025.system.demo.lesson.LessonContentType> lessonTypes,
                               List<String> lessonUrls, List<Integer> lessonDurations, List<ExamDTO> lessonAssessments) {
        public DraftSection(String title, List<String> lessons, List<Long> sourceTopicIds,
                            List<String> lessonMaterials,
                            List<com.example.starter_project_2025.system.demo.lesson.LessonContentType> lessonTypes,
                            List<String> lessonUrls, List<Integer> lessonDurations) {
            this(title, lessons, sourceTopicIds, lessonMaterials, lessonTypes, lessonUrls, lessonDurations, null);
        }
        public DraftSection(String title, List<String> lessons) {
            this(title, lessons, null, null, null, null, null);
        }
        public DraftSection(String title, List<String> lessons, List<Long> sourceTopicIds) {
            this(title, lessons, sourceTopicIds, null, null, null, null);
        }
        public DraftSection(String title, List<String> lessons, List<Long> sourceTopicIds,
                            List<String> lessonMaterials) {
            this(title, lessons, sourceTopicIds, lessonMaterials, null, null, null);
        }
    }

    public record ScopeRequest(List<Long> selectedTopicIds) {}
    /** Scope overlap is advisory in V2: exact outline duplicates are blocked on save. */
    public record ScopeCheck(boolean duplicate, Long existingCourseId, String existingCourseName,
                             long legacyUnverifiedCourseCount, long sameScopeCourseCount) {
        public ScopeCheck(boolean duplicate, Long id, String name, long unknown) {
            this(duplicate, id, name, unknown, duplicate ? 1 : 0);
        }
    }
    public record AiRequest(List<Long> selectedTopicIds, String instruction,
                            String expansionMode, Boolean researchExternal) {
        public AiRequest(List<Long> ids, String instruction) {
            this(ids, instruction, "BALANCED", false);
        }
    }
    /** URLs must originate from Gemini grounding metadata; never accept AI-imagined URLs. */
    public record AiResource(String title, String url) {}
    public record AiSuggestion(String name, String description, String level,
                               List<Long> categoryIds, List<DraftSection> sections,
                               List<AiResource> resources, String researchStatus) {}

    public record CreateRequest(CourseDTO course, List<DraftSection> sections,
                                List<Long> selectedTopicIds, List<AiResource> resources) {
        public CreateRequest(CourseDTO course, List<DraftSection> sections) {
            this(course, sections, null, List.of()); // existing callers
        }
        public CreateRequest(CourseDTO course, List<DraftSection> sections, List<Long> selectedTopicIds) {
            this(course, sections, selectedTopicIds, List.of());
        }
    }
}
