
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
}
