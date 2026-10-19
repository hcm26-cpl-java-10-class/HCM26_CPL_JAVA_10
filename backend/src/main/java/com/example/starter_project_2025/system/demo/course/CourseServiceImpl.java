package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.system.demo.category.CategoryRepository;
import com.example.starter_project_2025.system.demo.curriculum.CurriculumValidationResult;
import com.example.starter_project_2025.system.demo.curriculum.CurriculumValidator;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
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
    CurriculumValidator curriculumValidator;

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
        if (request.getIsFree() == null) {
            request.setIsFree(course.getIsFree());
        }
        validatePublishTransition(course, request, ctx);
    }

    /** Chuyển sang PUBLISHED phải qua Validate Publish (>=1 section, mỗi section >=1 lesson, URL hợp lệ). */
    private void validatePublishTransition(Course course, CourseDTO request, ValidationContext ctx) {
        if (request.getStatus() != CourseStatus.PUBLISHED
                || course.getStatus() == CourseStatus.PUBLISHED) {
            return;
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
}