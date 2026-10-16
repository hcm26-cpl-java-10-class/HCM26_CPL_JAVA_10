package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.system.demo.category.CategoryRepository;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.course.dto.PublishValidationResult;
import com.example.starter_project_2025.system.demo.course.dto.ReorderRequest;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CourseServiceImpl
        extends BaseCrudServiceImpl<Course, Long, CourseDTO, CourseFilter>
        implements CourseService {

    CourseMapper courseMapper;
    CourseRepository courseRepository;
    UserRepository userRepository;
    CategoryRepository categoryRepository;
    SectionRepository sectionRepository;
    LessonRepository lessonRepository;

    // ------------------------------------------------------------------ BaseCrud hooks

    @Override
    protected BaseCrudRepository<Course, Long> getRepository() {
        return courseRepository;
    }

    @Override
    protected BaseCrudMapper<Course, CourseDTO> getMapper() {
        return courseMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"name", "description", "instructor"};
    }

    @Override
    protected void beforeCreate(Course course, CourseDTO request, ValidationContext ctx) {
        if (courseRepository.existsByName(request.getName())) {
            ctx.add("name", "Course name already exists");
        }
        if (course.getStatus() == null) {
            course.setStatus(CourseStatus.DRAFT);
        }
        resolveInstructor(course, request);
        resolveCategory(course, request, ctx);
    }

    @Override
    protected void beforeUpdate(Course course, CourseDTO request, ValidationContext ctx) {
        if (request.getName() != null &&
                !request.getName().equals(course.getName()) &&
                courseRepository.existsByName(request.getName())) {
            ctx.add("name", "Course name already exists");
        }
        if (request.getInstructorId() != null) {
            resolveInstructor(course, request);
        }
        if (request.getCategoryId() != null) {
            resolveCategory(course, request, ctx);
        }
    }

    // ------------------------------------------------------------------ read

    @Override
    public Page<CourseDTO> getAll(Pageable pageable, String search, CourseFilter filter) {
        if (!canManageCourses()) {
            if (filter == null) {
                filter = new CourseFilter();
            }
            filter.setStatus(CourseStatus.PUBLISHED);
        }
        return super.getAll(pageable, search, filter);
    }

    @Override
    public CourseDTO getById(Long id) {
        CourseDTO course = super.getById(id);
        if (!canManageCourses() && course.getStatus() != CourseStatus.PUBLISHED) {
            throw new ResourceNotFoundException("Entity not found");
        }
        return course;
    }

    // ------------------------------------------------------------------ M2: validate & publish

    /**
     * Validate khoá học trước khi publish.
     * Điều kiện:
     * <ol>
     *   <li>Khoá học phải tồn tại.</li>
     *   <li>Có ít nhất 1 Section đang active.</li>
     *   <li>Mỗi Section active phải có ít nhất 1 Lesson đang active.</li>
     *   <li>Những Lesson có contentType = VIDEO / DOCUMENT / LINK
     *       phải có contentUrl không rỗng và đúng định dạng URL.</li>
     * </ol>
     */
    @Override
    @Transactional(readOnly = true)
    public PublishValidationResult validateForPublish(Long courseId) {
        courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));

        List<String> errors = new ArrayList<>();

        List<Section> sections = sectionRepository.findByCourse_IdOrderByOrderIndexAsc(courseId)
                .stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .toList();

        if (sections.isEmpty()) {
            errors.add("Khoá học phải có ít nhất 1 section.");
        } else {
            // Lấy tất cả lesson active của khoá học, group theo sectionId
            Map<Long, List<Lesson>> lessonsBySection = lessonRepository
                    .findActiveByCourseIdOrdered(courseId)
                    .stream()
                    .collect(Collectors.groupingBy(l -> l.getSection().getId()));

            for (Section section : sections) {
                List<Lesson> lessons = lessonsBySection.getOrDefault(section.getId(), List.of());

                if (lessons.isEmpty()) {
                    errors.add("Section \"" + section.getTitle() + "\" phải có ít nhất 1 lesson.");
                    continue;
                }

                for (Lesson lesson : lessons) {
                    validateLessonUrl(lesson, section.getTitle(), errors);
                }
            }
        }

        return errors.isEmpty() ? PublishValidationResult.ok() : PublishValidationResult.fail(errors);
    }

    /**
     * Validate rồi chuyển trạng thái khoá học sang {@link CourseStatus#PUBLISHED}.
     *
     * @throws BadRequestException nếu khoá học không đủ điều kiện publish.
     */
    @Override
    public CourseDTO publishCourse(Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));

        PublishValidationResult result = validateForPublish(courseId);
        if (!result.valid()) {
            throw new BadRequestException(
                    "Khoá học chưa đủ điều kiện publish: " + String.join("; ", result.errors()));
        }

        course.setStatus(CourseStatus.PUBLISHED);
        courseRepository.save(course);
        return courseMapper.toResponse(course);
    }

    // ------------------------------------------------------------------ M2: batch reorder

    /**
     * Cập nhật thứ tự Section và Lesson trong 1 request duy nhất.
     * Cho phép chuyển Lesson sang Section khác (trong cùng khoá học).
     *
     * @throws BadRequestException nếu section/lesson không thuộc khoá học này.
     */
    public void reorderCurriculum(Long courseId, ReorderRequest request) {
        courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));

        // Kiểm tra tất cả section thuộc đúng khoá học này
        Set<Long> courseSectionIds = sectionRepository
                .findByCourse_IdOrderByOrderIndexAsc(courseId)
                .stream()
                .map(Section::getId)
                .collect(Collectors.toSet());

        for (ReorderRequest.SectionOrder so : request.sections()) {
            if (!courseSectionIds.contains(so.sectionId())) {
                throw new BadRequestException(
                        "Section id=" + so.sectionId() + " không thuộc khoá học id=" + courseId);
            }
        }

        // Lấy tất cả lesson của khoá học để validate
        Map<Long, Lesson> lessonMap = lessonRepository.findByCourseIdOrdered(courseId)
                .stream()
                .collect(Collectors.toMap(Lesson::getId, l -> l));

        // Áp dụng thay đổi
        Map<Long, Section> sectionMap = sectionRepository
                .findByCourse_IdOrderByOrderIndexAsc(courseId)
                .stream()
                .collect(Collectors.toMap(Section::getId, s -> s));

        for (ReorderRequest.SectionOrder so : request.sections()) {
            Section section = sectionMap.get(so.sectionId());
            section.setOrderIndex(so.orderIndex());
            sectionRepository.save(section);

            if (so.lessons() == null) continue;

            for (ReorderRequest.LessonOrder lo : so.lessons()) {
                Lesson lesson = lessonMap.get(lo.lessonId());
                if (lesson == null) {
                    throw new BadRequestException(
                            "Lesson id=" + lo.lessonId() + " không thuộc khoá học id=" + courseId);
                }
                // Chuyển lesson sang section mới nếu cần
                if (!lesson.getSection().getId().equals(so.sectionId())) {
                    lesson.setSection(section);
                }
                lesson.setOrderIndex(lo.orderIndex());
                lessonRepository.save(lesson);
            }
        }
    }

    // ------------------------------------------------------------------ helpers

    private boolean canManageCourses() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "COURSE_UPDATE".equals(a.getAuthority()));
    }

    /**
     * Nếu instructorId được cung cấp, tìm user và tự động fill:
     * - course.instructorUser = user
     * - course.instructor = user.fullName (nếu instructor string không được set thủ công)
     */
    private void resolveInstructor(Course course, CourseDTO request) {
        if (request.getInstructorId() != null) {
            userRepository.findById(request.getInstructorId()).ifPresent(user -> {
                course.setInstructorUser(user);
                // Auto-fill instructor name from user if not manually provided
                if (request.getInstructor() == null || request.getInstructor().isBlank()) {
                    course.setInstructor(user.getFullName());
                }
            });
        } else {
            // Clear instructor user if no instructorId provided
            course.setInstructorUser(null);
        }
    }

    /** categoryId lấy từ request; null = không thuộc danh mục nào. */
    private void resolveCategory(Course course, CourseDTO request, ValidationContext ctx) {
        Long categoryId = request.getCategoryId();
        if (categoryId == null) {
            course.setCategory(null);
            return;
        }
        categoryRepository.findById(categoryId).ifPresentOrElse(
                course::setCategory,
                () -> ctx.add("categoryId", "Category not found")
        );
    }

    /**
     * Kiểm tra URL của lesson.
     * Lesson loại VIDEO / DOCUMENT / LINK phải có contentUrl không rỗng và hợp lệ.
     * Lesson loại TEXT không bắt buộc có URL.
     */
    private static final Set<LessonContentType> URL_REQUIRED_TYPES =
            Set.of(LessonContentType.VIDEO, LessonContentType.DOCUMENT, LessonContentType.LINK);

    private void validateLessonUrl(Lesson lesson, String sectionTitle, List<String> errors) {
        if (!URL_REQUIRED_TYPES.contains(lesson.getContentType())) {
            return; // TEXT không cần URL
        }
        String url = lesson.getContentUrl();
        if (url == null || url.isBlank()) {
            errors.add("Lesson \"" + lesson.getTitle() + "\" (section \"" + sectionTitle
                    + "\") thiếu content URL.");
            return;
        }
        if (!isValidUrl(url.trim())) {
            errors.add("Lesson \"" + lesson.getTitle() + "\" (section \"" + sectionTitle
                    + "\") có URL không hợp lệ: " + url);
        }
    }

    private boolean isValidUrl(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            return ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                    && uri.getHost() != null
                    && !uri.getHost().isBlank();
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
