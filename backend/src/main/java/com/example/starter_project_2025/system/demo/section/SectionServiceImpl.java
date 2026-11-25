
package com.example.starter_project_2025.system.demo.section;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;


import com.example.starter_project_2025.exception.ResourceNotFoundException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(
        level = AccessLevel.PRIVATE,
        makeFinal = true
)
public class SectionServiceImpl
        extends BaseCrudServiceImpl<
        Section,
        Long,
        SectionDTO,
        SectionFilter
        >
        implements SectionService {

    SectionRepository sectionRepository;
    SectionMapper sectionMapper;
    CourseRepository courseRepository;
    LessonRepository lessonRepository;

    // ======================================
    // BASE CRUD CONFIG
    // ======================================

    @Override
    protected BaseCrudRepository<Section, Long> getRepository() {
        return sectionRepository;
    }

    @Override
    protected BaseCrudMapper<Section, SectionDTO> getMapper() {
        return sectionMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"title"};
    }

    // ======================================
    // BEFORE CREATE
    // ======================================

    @Override
    protected void beforeCreate(
            Section section,
            SectionDTO request,
            ValidationContext ctx
    ) {
        Long courseId = request.getCourseId();

        if (courseId == null) {
            ctx.add("courseId", "Course ID is required");
            return;
        }

        Course course = courseRepository
                .findById(courseId)
                .orElse(null);

        if (course == null) {
            ctx.add("courseId", "Course not found");
            return;
        }

        section.setCourse(course);

        validateFields(
                request,
                ctx,
                courseId,
                null,
                null,
                true
        );

        if (request.getTitle() != null) {
            section.setTitle(request.getTitle());
        }
    }

    // ======================================
    // BEFORE UPDATE
    // ======================================

    @Override
    protected void beforeUpdate(
            Section section,
            SectionDTO request,
            ValidationContext ctx
    ) {
        Long courseId = section.getCourse().getId();

        // Không cho chuyển Section sang Course khác
        if (
                request.getCourseId() != null &&
                        !request.getCourseId().equals(courseId)
        ) {
            ctx.add(
                    "courseId",
                    "Cannot change course of a section"
            );
        }

        validateFields(
                request,
                ctx,
                courseId,
                section.getId(),
                section.getOrderIndex(),
                false
        );
    }

    // ======================================
    // VALIDATION
    // ======================================

    private void validateFields(
            SectionDTO request,
            ValidationContext ctx,
            Long courseId,
            Long editingId,
            Integer currentOrder,
            boolean creating
    ) {
        // Lấy Section trong cùng Course
        List<Section> existingSections =
                sectionRepository
                        .findByCourse_IdOrderByOrderIndexAsc(
                                courseId
                        );

        // ==================================
        // CHECK TITLE
        // ==================================

        if (request.getTitle() == null) {
            if (creating) {
                ctx.add(
                        "title",
                        "Section title is required"
                );
            }
        } else {
            String cleanTitle = normalizeTitle(
                    request.getTitle()
            );

            request.setTitle(cleanTitle);

            if (cleanTitle.isEmpty()) {
                ctx.add(
                        "title",
                        "Section title is required"
                );

            } else if (cleanTitle.length() < 3) {
                ctx.add(
                        "title",
                        "Section title must have at least 3 characters"
                );

            } else if (cleanTitle.length() > 150) {
                ctx.add(
                        "title",
                        "Section title cannot exceed 150 characters"
                );

            } else if (
                    cleanTitle.codePoints()
                            .noneMatch(Character::isLetter)
            ) {
                ctx.add(
                        "title",
                        "Section title must contain letters"
                );

            } else {
                String key = cleanTitle.toLowerCase(
                        Locale.ROOT
                );

                // Trùng tên trong cùng Course
                boolean duplicateTitle = existingSections
                        .stream()
                        .anyMatch(other ->
                                !Objects.equals(
                                        other.getId(),
                                        editingId
                                )
                                        &&
                                        normalizeTitle(
                                                other.getTitle()
                                        )
                                                .toLowerCase(Locale.ROOT)
                                                .equals(key)
                        );

                if (duplicateTitle) {
                    ctx.add(
                            "title",
                            "Section title already exists in this course"
                    );
                }
            }
        }

        // ==================================
        // CHECK ORDER INDEX
        // ==================================

        Integer order = request.getOrderIndex();

        if (order == null) {
            if (creating) {
                ctx.add(
                        "orderIndex",
                        "Order index is required"
                );
            }

        } else if (order < 0) {
            ctx.add(
                    "orderIndex",
                    "Order index cannot be negative"
            );

        } else if (
                creating ||
                        !order.equals(currentOrder)
        ) {
            // Chỉ kiểm tra trùng thứ tự
            // khi tạo mới hoặc thay đổi Order
            boolean duplicateOrder = existingSections
                    .stream()
                    .anyMatch(other ->
                            !Objects.equals(
                                    other.getId(),
                                    editingId
                            )
                                    &&
                                    Objects.equals(
                                            other.getOrderIndex(),
                                            order
                                    )
                    );

            if (duplicateOrder) {
                ctx.add(
                        "orderIndex",
                        "Order index already exists in this course"
                );
            }
        }
    }

    // ======================================
    // BEFORE DELETE
    // ======================================

    @Override
    protected void beforeDelete(Section section) {
        // Không cho xóa Section đang chứa Lesson
        boolean hasLessons = !lessonRepository
                .findBySection_IdOrderByOrderIndexAsc(
                        section.getId()
                )
                .isEmpty();

        if (hasLessons) {
            throw new BusinessValidationException(
                    Map.of(
                            "section",
                            List.of(
                                    "Cannot delete a section containing lessons. Delete the lessons first."
                            )
                    )
            );
        }
    }

    // ======================================
    // NORMALIZE TITLE
    // ======================================

    private String normalizeTitle(String title) {
        return title.strip().replaceAll(
                "(?U)\\s+",
                " "
        );
    }

    // ======================================
// BULK CREATE SECTIONS
// ======================================

    @Override
    @Transactional
    public List<SectionDTO> createBulk(
            Long courseId,
            List<String> titles
    ) {
        if (courseId == null || courseId <= 0) {
            throw bulkError(
                    "courseId",
                    "Please select a valid course"
            );
        }

        if (titles == null ||
                titles.isEmpty() ||
                titles.size() > 30) {
            throw bulkError(
                    "titles",
                    "Number of sections must be between 1 and 30"
            );
        }

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Course not found: " + courseId
                        )
                );

        List<Section> existingSections =
                sectionRepository.findByCourse_IdOrderByOrderIndexAsc(
                        courseId
                );

        Set<String> usedTitles = new HashSet<>();

        for (Section existing : existingSections) {
            if (existing.getTitle() != null) {
                usedTitles.add(
                        normalizeTitle(existing.getTitle())
                                .toLowerCase(Locale.ROOT)
                );
            }
        }

        List<String> cleanedTitles = new ArrayList<>();

        // Validate all titles before saving anything.
        for (int i = 0; i < titles.size(); i++) {
            String raw = titles.get(i);

            String clean = raw == null
                    ? ""
                    : normalizeTitle(raw);

            String field = "titles[" + i + "]";

            if (clean.isEmpty()) {
                throw bulkError(
                        field,
                        "Section " + (i + 1) + ": title is required"
                );
            }

            if (clean.length() < 3) {
                throw bulkError(
                        field,
                        "Section " + (i + 1)
                                + ": title must contain at least 3 characters"
                );
            }

            if (clean.length() > 150) {
                throw bulkError(
                        field,
                        "Section " + (i + 1)
                                + ": title must not exceed 150 characters"
                );
            }

            if (clean.codePoints().noneMatch(Character::isLetter)) {
                throw bulkError(
                        field,
                        "Section " + (i + 1)
                                + ": title must contain letters"
                );
            }

            String key = clean.toLowerCase(Locale.ROOT);

            if (!usedTitles.add(key)) {
                throw bulkError(
                        field,
                        "Section " + (i + 1)
                                + ": title already exists in this course or request"
                );
            }

            cleanedTitles.add(clean);
        }

        // Append after the current highest order.
        int maxOrder = existingSections.stream()
                .map(Section::getOrderIndex)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0);

        maxOrder = Math.max(0, maxOrder);

        if (maxOrder > Integer.MAX_VALUE - cleanedTitles.size()) {
            throw bulkError(
                    "orderIndex",
                    "Section order limit exceeded"
            );
        }

        List<Section> newSections = new ArrayList<>();

        for (int i = 0; i < cleanedTitles.size(); i++) {
            Section section = new Section();

            section.setCourse(course);
            section.setTitle(cleanedTitles.get(i));
            section.setOrderIndex(maxOrder + i + 1);

            newSections.add(section);
        }

        // Transaction: all succeed or all roll back.
        List<Section> saved =
                sectionRepository.saveAllAndFlush(newSections);

        return saved.stream()
                .map(sectionMapper::toResponse)
                .toList();
    }

    private BusinessValidationException bulkError(
            String field,
            String message
    ) {
        return new BusinessValidationException(
                Map.of(field, List.of(message))
        );
    }
}
