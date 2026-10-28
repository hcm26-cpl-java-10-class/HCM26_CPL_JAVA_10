package com.example.starter_project_2025.system.demo.curriculum;

import com.example.starter_project_2025.system.demo.curriculum.CurriculumValidationResult.Issue;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Validate Publish (2.5): >=1 Section, mỗi Section >=1 Lesson,
 * VIDEO/AUDIO/DOCUMENT/LINK có URL http/https hợp lệ, TEXT có textContent.
 * Section/Lesson inactive không được tính.
 */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CurriculumValidator {

    static final int MAX_URL_LENGTH = 500;

    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;

    public CurriculumValidationResult validatePublish(Long courseId) {
        List<Issue> errors = new ArrayList<>();

        List<Section> sections = sectionRepository.findByCourse_IdOrderByOrderIndexAsc(courseId).stream()
                .filter(section -> Boolean.TRUE.equals(section.getIsActive()))
                .toList();

        if (sections.isEmpty()) {
            errors.add(new Issue("NO_SECTION", null, null,
                    "Course must have at least 1 section before publishing"));
            return CurriculumValidationResult.of(errors);
        }

        Map<Long, List<Lesson>> lessonsBySection = new LinkedHashMap<>();
        for (Lesson lesson : lessonRepository.findActiveByCourseIdOrdered(courseId)) {
            lessonsBySection
                    .computeIfAbsent(lesson.getSection().getId(), key -> new ArrayList<>())
                    .add(lesson);
        }

        for (Section section : sections) {
            List<Lesson> lessons = lessonsBySection.getOrDefault(section.getId(), List.of());
            if (lessons.isEmpty()) {
                errors.add(new Issue("SECTION_EMPTY", section.getId(), null,
                        "Section '" + section.getTitle() + "' must have at least 1 lesson"));
                continue;
            }
            for (Lesson lesson : lessons) {
                validateLesson(section, lesson, errors);
            }
        }

        return CurriculumValidationResult.of(errors);
    }

    private void validateLesson(Section section, Lesson lesson, List<Issue> errors) {
        LessonContentType type = lesson.getContentType();
        String label = "Lesson '" + lesson.getTitle() + "' (section '" + section.getTitle() + "')";

        if (type == null) {
            errors.add(new Issue("LESSON_CONTENT_TYPE_MISSING", section.getId(), lesson.getId(),
                    label + " has no content type"));
            return;
        }

        switch (type) {
            case VIDEO, AUDIO, DOCUMENT, LINK -> {
                String url = lesson.getContentUrl();
                if (url == null || url.isBlank()) {
                    errors.add(new Issue("LESSON_URL_MISSING", section.getId(), lesson.getId(),
                            label + " requires a content URL (" + type + ")"));
                } else if (!isValidHttpUrl(url)) {
                    errors.add(new Issue("LESSON_URL_INVALID", section.getId(), lesson.getId(),
                            label + " has an invalid content URL (must be http/https, max "
                                    + MAX_URL_LENGTH + " characters)"));
                }
            }
            case TEXT -> {
                String text = lesson.getTextContent();
                if (text == null || text.isBlank()) {
                    errors.add(new Issue("LESSON_TEXT_MISSING", section.getId(), lesson.getId(),
                            label + " requires text content (TEXT)"));
                }
            }
        }
    }

    static boolean isValidHttpUrl(String value) {
        if (value == null) {
            return false;
        }
        String url = value.trim();
        if (url.isEmpty() || url.length() > MAX_URL_LENGTH) {
            return false;
        }
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme();
            boolean httpScheme = "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
            return httpScheme && uri.getHost() != null && !uri.getHost().isBlank();
        } catch (URISyntaxException ex) {
            return false;
        }
    }
}
