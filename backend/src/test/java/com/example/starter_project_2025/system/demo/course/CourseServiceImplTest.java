package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.demo.category.Category;
import com.example.starter_project_2025.system.demo.category.CategoryRepository;
import com.example.starter_project_2025.system.demo.curriculum.CurriculumValidator;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.notification.NotificationService;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CourseServiceImplTest {

    private final CourseMapper courseMapper = mock(CourseMapper.class);
    private final CourseRepository courseRepository = mock(CourseRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final CategoryRepository categoryRepository = mock(CategoryRepository.class);
    private final CourseServiceImpl service = new CourseServiceImpl(
            courseMapper,
            courseRepository,
            userRepository,
            categoryRepository,
            mock(SyllabusRepository.class),
            new CurriculumValidator(mock(SectionRepository.class), mock(LessonRepository.class)),
            mock(NotificationService.class)
    );

    @Test
    void clearCategoryEmptiesManagedCollectionWithoutReplacingIt() {
        Set<Category> categories = new HashSet<>(Set.of(Category.builder().id(1L).name("Java").build()));
        Course course = Course.builder().categories(categories).build();
        CourseDTO request = CourseDTO.builder().clearCategory(true).build();

        service.beforeUpdate(course, request, new ValidationContext());

        assertSame(categories, course.getCategories());
        assertTrue(course.getCategories().isEmpty());
    }

    @Test
    void rejectsUnknownInstructorId() {
        when(userRepository.findById(22L)).thenReturn(Optional.empty());
        ValidationContext context = new ValidationContext();

        service.beforeCreate(Course.builder().build(),
                CourseDTO.builder().name("Java").instructorId(22L).build(), context);

        assertEquals("Instructor not found: 22", context.getErrors().get("instructorId").getFirst());
    }

    @Test
    void rejectsDuplicateCourseNameOnCreate() {
        when(courseRepository.existsByName("Java")).thenReturn(true);
        ValidationContext context = new ValidationContext();

        service.beforeCreate(Course.builder().build(), CourseDTO.builder().name("Java").build(), context);

        assertEquals("Course name already exists", context.getErrors().get("name").getFirst());
    }

    @Test
    void rejectsUserWithoutTeacherRole() {
        User user = User.builder()
                .id(22L)
                .firstName("Sam")
                .roles(new HashSet<>(Set.of(Role.builder().name("STUDENT").build())))
                .build();
        when(userRepository.findById(22L)).thenReturn(Optional.of(user));
        ValidationContext context = new ValidationContext();

        service.beforeCreate(Course.builder().build(),
                CourseDTO.builder().name("Java").instructorId(22L).build(), context);

        assertEquals("Selected user is not authorized to teach courses",
                context.getErrors().get("instructorId").getFirst());
    }

    @Test
    void updateWithoutInstructorFieldsKeepsExistingAssignment() {
        User instructor = teacher(22L);
        Course course = Course.builder().instructorUser(instructor).build();

        service.beforeUpdate(course, CourseDTO.builder().build(), new ValidationContext());

        assertSame(instructor, course.getInstructorUser());
    }

    @Test
    void updateCanAssignExistingTeacher() {
        User instructor = teacher(23L);
        Course course = Course.builder().build();
        when(userRepository.findById(23L)).thenReturn(Optional.of(instructor));

        service.beforeUpdate(course, CourseDTO.builder().instructorId(23L).build(), new ValidationContext());

        assertSame(instructor, course.getInstructorUser());
        assertEquals("Teacher", course.getInstructor());
    }

    @Test
    void updateCanClearInstructorAssignmentExplicitly() {
        Course course = Course.builder().instructorUser(teacher(22L)).build();

        service.beforeUpdate(course, CourseDTO.builder().clearInstructor(true).build(), new ValidationContext());

        assertNull(course.getInstructorUser());
    }

    @Test
    void updateRejectsConflictingInstructorAssignmentAndClear() {
        Course course = Course.builder().instructorUser(teacher(22L)).build();
        ValidationContext context = new ValidationContext();

        service.beforeUpdate(course,
                CourseDTO.builder().instructorId(23L).clearInstructor(true).build(), context);

        assertEquals("Cannot assign and clear the instructor in the same request",
                context.getErrors().get("instructorId").getFirst());
    }

    @Test
    void rejectsInvalidThumbnailUrl() {
        ValidationContext context = new ValidationContext();

        service.beforeCreate(Course.builder().build(),
                CourseDTO.builder().name("Java").thumbnailUrl("javascript:alert(1)").build(), context);

        assertEquals("Thumbnail URL must be a valid http/https URL",
                context.getErrors().get("thumbnailUrl").getFirst());
    }

    @Test
    void rejectsUnknownCategoryId() {
        ValidationContext context = new ValidationContext();
        when(categoryRepository.findById(99L)).thenReturn(Optional.empty());

        service.beforeCreate(Course.builder().build(),
                CourseDTO.builder().name("Java").categoryIds(List.of(99L)).build(), context);

        assertEquals("Category not found: 99", context.getErrors().get("categoryIds").getFirst());
    }

    @Test
    void rejectsInactiveCategory() {
        ValidationContext context = new ValidationContext();
        Category category = Category.builder().id(99L).name("Inactive").isActive(false).build();
        when(categoryRepository.findById(99L)).thenReturn(Optional.of(category));

        service.beforeCreate(Course.builder().build(),
                CourseDTO.builder().name("Java").categoryIds(List.of(99L)).build(), context);

        assertEquals("Category is inactive: Inactive", context.getErrors().get("categoryIds").getFirst());
    }

    @Test
    void acceptsValidThumbnailUrl() {
        ValidationContext context = new ValidationContext();

        service.beforeCreate(Course.builder().build(),
                CourseDTO.builder().name("Java").thumbnailUrl("https://example.com/image.png").build(), context);

        assertTrue(context.getErrors().isEmpty());
    }

    @Test
    void rejectsPublishingWhenRequiredCourseDetailsAreMissing() {
        Course course = Course.builder()
                .id(10L)
                .status(CourseStatus.DRAFT)
                .build();
        CourseDTO request = CourseDTO.builder()
                .status(CourseStatus.PUBLISHED)
                .description(" ")
                .build();
        ValidationContext context = new ValidationContext();

        service.beforeUpdate(course, request, context);

        assertEquals("Assign an instructor before publishing",
                context.getErrors().get("instructorId").getFirst());
        assertEquals("Select at least one category before publishing",
                context.getErrors().get("categoryIds").getFirst());
        assertEquals("Select a course level before publishing",
                context.getErrors().get("level").getFirst());
        assertEquals("Add a course description before publishing",
                context.getErrors().get("description").getFirst());
    }

    @Test
    void acceptsExistingRequiredCourseDetailsDuringPublishValidation() {
        Course course = Course.builder()
                .id(10L)
                .status(CourseStatus.DRAFT)
                .instructorUser(teacher(22L))
                .categories(new HashSet<>(Set.of(Category.builder().id(1L).name("Java").build())))
                .level(CourseLevel.BEGINNER)
                .description("Learn Java fundamentals")
                .build();
        ValidationContext context = new ValidationContext();

        service.beforeUpdate(course,
                CourseDTO.builder().status(CourseStatus.PUBLISHED).build(), context);

        assertTrue(context.getErrors().keySet().stream()
                .noneMatch(Set.of("instructorId", "categoryIds", "level", "description")::contains));
    }

    private static User teacher(Long id) {
        return User.builder()
                .id(id)
                .firstName("Teacher")
                .roles(new HashSet<>(Set.of(Role.builder().name("TEACHER").build())))
                .build();
    }
}
