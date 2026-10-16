package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.demo.category.Category;
import com.example.starter_project_2025.system.demo.category.CategoryRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;

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

    @Autowired
    CategoryRepository categoryRepository;

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
        // existing checks...
        if (request.getCategoryIds() != null && !request.getCategoryIds().isEmpty()) {
            List<Category> cats = categoryRepository.findAllById(request.getCategoryIds());
            if (cats.size() != request.getCategoryIds().size()) {
                ctx.add("categoryIds", "Some categories not found");
            } else {
                course.setCategories(new HashSet<>(cats));
            }
        }
    }
    @Override
    protected void beforeUpdate(Course course, CourseDTO request, ValidationContext ctx) {
        // if categoryIds provided, update relations
        if (request.getCategoryIds() != null) {
            List<Category> cats = categoryRepository.findAllById(request.getCategoryIds());
            if (cats.size() != request.getCategoryIds().size()) {
                ctx.add("categoryIds", "Some categories not found");
            } else {
                course.setCategories(new HashSet<>(cats));
            }
        }
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
}
