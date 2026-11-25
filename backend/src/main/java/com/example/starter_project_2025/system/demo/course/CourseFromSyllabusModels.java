package com.example.starter_project_2025.system.demo.course;

import java.util.List;

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
    public record DraftSection(String title, List<String> lessons) {}

    public record CreateRequest(CourseDTO course, List<DraftSection> sections) {}
}
