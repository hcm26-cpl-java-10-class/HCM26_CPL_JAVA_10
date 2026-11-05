package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.system.demo.category.Category;
import com.example.starter_project_2025.system.demo.category.CategoryRepository;
import com.example.starter_project_2025.system.demo.syllabus.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusStatus;
import com.example.starter_project_2025.system.demo.curriculum.CurriculumValidationResult;
import com.example.starter_project_2025.system.demo.curriculum.CurriculumValidator;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

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
    SyllabusRepository syllabusRepository;
    CurriculumValidator curriculumValidator;
    NotificationService notificationService;

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
        if (request.getStatus() == CourseStatus.PUBLISHED) {
            ctx.add("status", "A new course has no sections or lessons yet. "
                    + "Save it as Draft, add content, then publish.");
        }
        if (course.getStatus() == null) {
            course.setStatus(CourseStatus.DRAFT);
        }
        if (course.getIsFree() == null) {
            course.setIsFree(true);
        }
        if (request.getInstructorId() != null) {
            resolveInstructor(course, request, ctx);
        }
        validateThumbnailUrl(request.getThumbnailUrl(), ctx);
        resolveCategories(course, request, ctx);
        resolveSyllabus(course, request, ctx);
    }

    @Override
    protected void beforeUpdate(Course course, CourseDTO request, ValidationContext ctx) {
        if (request.getName() != null &&
                !request.getName().equals(course.getName()) &&
                courseRepository.existsByName(request.getName())) {
            ctx.add("name", "Course name already exists");
        }
        if (Boolean.TRUE.equals(request.getClearInstructor()) && request.getInstructorId() != null) {
            ctx.add("instructorId", "Cannot assign and clear the instructor in the same request");
        } else if (Boolean.TRUE.equals(request.getClearInstructor())) {
            course.setInstructorUser(null);
        } else if (request.getInstructorId() != null) {
            resolveInstructor(course, request, ctx);
        }
        if (Boolean.TRUE.equals(request.getClearCategory())) {
            course.getCategories().clear();
        } else if (request.getCategoryIds() != null) {
            resolveCategories(course, request, ctx);
        }
        validateThumbnailUrl(request.getThumbnailUrl(), ctx);
        resolveSyllabus(course, request, ctx);
        if (request.getIsFree() == null) {
            request.setIsFree(course.getIsFree());
        }
        validatePublishTransition(course, request, ctx);
    }

    @Override
    protected void afterUpdate(Course course, CourseDTO request) {
        if (request.getStatus() == CourseStatus.PUBLISHED && course.getInstructorUser() != null) {
            notificationService.createOnce(
                    course.getInstructorUser().getId(),
                    "course-published:" + course.getId(),
                    "Course published",
                    course.getName() + " is now available to students.",
                    "/courses/" + course.getId()
            );
        }
    }

    /** Chuyển sang PUBLISHED phải qua Validate Publish (>=1 section, mỗi section >=1 lesson, URL hợp lệ). */
    private void validatePublishTransition(Course course, CourseDTO request, ValidationContext ctx) {
        if (request.getStatus() != CourseStatus.PUBLISHED
                || course.getStatus() == CourseStatus.PUBLISHED) {
            return;
        }

        if (course.getInstructorUser() == null) {
            ctx.add("instructorId", "Assign an instructor before publishing");
        }
        if (course.getCategories() == null || course.getCategories().isEmpty()) {
            ctx.add("categoryIds", "Select at least one category before publishing");
        }

        CourseLevel level = request.getLevel() != null ? request.getLevel() : course.getLevel();
        if (level == null) {
            ctx.add("level", "Select a course level before publishing");
        }

        String description = request.getDescription() != null
                ? request.getDescription()
                : course.getDescription();
        if (description == null || description.isBlank()) {
            ctx.add("description", "Add a course description before publishing");
        }

        if (course.getSyllabus() != null && !isSelectable(course.getSyllabus())) {
            ctx.add("syllabusId", "Select a Published and Active syllabus before publishing");
        }

        CurriculumValidationResult result = curriculumValidator.validatePublish(course.getId());
        result.errors().forEach(issue -> ctx.add("status", issue.message()));
    }


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
    private void resolveInstructor(Course course, CourseDTO request, ValidationContext ctx) {
        userRepository.findById(request.getInstructorId()).ifPresentOrElse(user -> {
            boolean isTeacher = user.getRoles().stream()
                    .anyMatch(role -> "TEACHER".equals(role.getName()));
            if (!isTeacher) {
                ctx.add("instructorId", "Selected user is not authorized to teach courses");
                return;
            }
            course.setInstructorUser(user);
            if (request.getInstructor() == null || request.getInstructor().isBlank()) {
                course.setInstructor(user.getFullName());
            }
        }, () -> ctx.add("instructorId", "Instructor not found: " + request.getInstructorId()));
    }

    private static boolean isSelectable(Syllabus syllabus) {
        return syllabus.getStatus() == SyllabusStatus.PUBLISHED
                && Boolean.TRUE.equals(syllabus.getIsActive());
    }

    private void resolveSyllabus(Course course, CourseDTO request, ValidationContext ctx) {
        if (Boolean.TRUE.equals(request.getClearSyllabus())) {
            if (request.getSyllabusId() != null) {
                ctx.add("syllabusId", "Cannot select and clear a syllabus together");
            } else {
                course.setSyllabus(null);
            }
            return;
        }
        if (request.getSyllabusId() == null) {
            return; // No change on update; optional on create.
        }
        syllabusRepository.findById(request.getSyllabusId()).ifPresentOrElse(
                syllabus -> {
                    if (!isSelectable(syllabus)) {
                        ctx.add("syllabusId", "Only Published and Active syllabuses can be assigned");
                    } else {
                        course.setSyllabus(syllabus);
                    }
                },
                () -> ctx.add("syllabusId", "Syllabus not found")
        );
    }

    private void validateThumbnailUrl(String thumbnailUrl, ValidationContext ctx) {
        if (thumbnailUrl == null || thumbnailUrl.isBlank()) {
            return;
        }
        try {
            URI uri = new URI(thumbnailUrl.trim());
            String scheme = uri.getScheme();
            if (!("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                    || uri.getHost() == null || uri.getHost().isBlank()) {
                ctx.add("thumbnailUrl", "Thumbnail URL must be a valid http/https URL");
            }
        } catch (URISyntaxException ex) {
            ctx.add("thumbnailUrl", "Thumbnail URL must be a valid http/https URL");
        }
    }

    /** categoryId lấy từ request; null = không thuộc danh mục nào. */
    private void resolveCategories(Course course, CourseDTO request, ValidationContext ctx) {
        List<Long> categoryIds = request.getCategoryIds();

        if (categoryIds == null || categoryIds.isEmpty()) {
            course.getCategories().clear();
            return;
        }

        Set<Category> categories = new LinkedHashSet<>();

        for (Long categoryId : categoryIds) {
            if (categoryId == null) {
                continue;
            }

            categoryRepository.findById(categoryId).ifPresentOrElse(
                    category -> {
                        if (!Boolean.TRUE.equals(category.getIsActive())) {
                            ctx.add("categoryIds", "Category is inactive: " + category.getName());
                            return;
                        }
                        categories.add(category);
                    },
                    () -> ctx.add("categoryIds", "Category not found: " + categoryId)
            );
        }

        course.setCategories(categories);
    }
}
