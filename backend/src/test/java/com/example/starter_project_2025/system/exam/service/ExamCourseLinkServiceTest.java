package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.ExamType;
import com.example.starter_project_2025.system.exam.dto.CourseExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExamCourseLinkServiceTest {

    @Mock
    private CourseRepository courseRepository;
    @Mock
    private SectionRepository sectionRepository;
    @Mock
    private LessonRepository lessonRepository;
    @Mock
    private CourseEnrollmentRepository enrollmentRepository;
    @Mock
    private ExamRepository examRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ExamAccessGuard examAccessGuard;
    @Mock
    private ExamProgressLockService lockService;

    @InjectMocks
    private ExamCourseLinkService service;

    private User teacherUser;
    private User otherTeacherUser;
    private User adminUser;
    private User studentUser;

    private Course course1;
    private Course course2;
    private Section section1;
    private Section section2;
    private Lesson lesson1;

    private UserPrincipal teacherPrincipal;
    private UserPrincipal otherTeacherPrincipal;
    private UserPrincipal adminPrincipal;
    private UserPrincipal studentPrincipal;

    @BeforeEach
    void setUp() {
        teacherUser = createUser(10L, "teacher@example.com", "Teacher One", "TEACHER");
        otherTeacherUser = createUser(20L, "other@example.com", "Teacher Two", "TEACHER");
        adminUser = createUser(99L, "admin@example.com", "Admin User", "ADMIN");
        studentUser = createUser(50L, "student@example.com", "Student One", "STUDENT");

        teacherPrincipal = new UserPrincipal(teacherUser, Collections.emptyList());
        otherTeacherPrincipal = new UserPrincipal(otherTeacherUser, Collections.emptyList());
        adminPrincipal = new UserPrincipal(adminUser, Collections.emptyList());
        studentPrincipal = new UserPrincipal(studentUser, Collections.emptyList());

        course1 = Course.builder()
                .name("Course 1")
                .instructorUser(teacherUser)
                .build();
        course1.setId(100L);

        course2 = Course.builder()
                .name("Course 2")
                .instructorUser(otherTeacherUser)
                .build();
        course2.setId(200L);

        section1 = Section.builder()
                .title("Section 1")
                .course(course1)
                .orderIndex(1)
                .build();
        section1.setId(10L);

        section2 = Section.builder()
                .title("Section 2")
                .course(course2)
                .orderIndex(1)
                .build();
        section2.setId(20L);

        lesson1 = Lesson.builder()
                .title("Lesson 1")
                .section(section1)
                .orderIndex(1)
                .build();
        lesson1.setId(5L);
    }

    private User createUser(Long id, String email, String fullName, String roleName) {
        Set<Role> roles = new HashSet<>();
        roles.add(Role.builder().name(roleName).build());
        return User.builder()
                .id(id)
                .email(email)
                .firstName(fullName)
                .roles(roles)
                .build();
    }

    private Exam createExam(Long id, Long createdBy, Course course, Section section, Lesson lesson) {
        Exam exam = new Exam();
        exam.setId(id);
        exam.setTitle("Exam " + id);
        exam.setCreatedBy(createdBy);
        exam.setCourse(course);
        exam.setSection(section);
        exam.setLesson(lesson);
        exam.setDurationMinutes(60);
        exam.setCategory(ExamCategory.ASSIGNMENT);
        exam.setExamType(ExamType.MIXED);
        exam.setIsActive(true);
        exam.setMaxScore(BigDecimal.TEN);
        exam.setPassScore(BigDecimal.valueOf(5));
        return exam;
    }

    // =========================================================================
    // apply tests
    // =========================================================================

    @Nested
    @DisplayName("apply tests")
    class ApplyTests {

        @Test
        @DisplayName("Should do nothing when course link is not provided in request")
        void apply_WhenCourseLinkNotProvided_ShouldDoNothing() {
            Exam exam = createExam(1L, teacherUser.getId(), course1, section1, null);
            ExamDTO request = new ExamDTO();
            ValidationContext ctx = new ValidationContext();

            service.apply(exam, request, ctx);

            assertFalse(ctx.hasErrors());
            assertEquals(course1, exam.getCourse());
            assertEquals(section1, exam.getSection());
        }

        @Test
        @DisplayName("Should auto-derive section and course when valid lessonId is provided")
        void apply_WhenLessonProvided_ShouldAutoDeriveSectionAndCourse() {
            Exam exam = new Exam();
            ExamDTO request = new ExamDTO();
            request.setLessonId(lesson1.getId());

            when(lessonRepository.findById(lesson1.getId())).thenReturn(Optional.of(lesson1));

            ValidationContext ctx = new ValidationContext();
            service.apply(exam, request, ctx);

            assertFalse(ctx.hasErrors());
            assertEquals(lesson1, exam.getLesson());
            assertEquals(section1, exam.getSection());
            assertEquals(course1, exam.getCourse());
        }

        @Test
        @DisplayName("Should throw ResourceNotFoundException when lessonId does not exist")
        void apply_WhenLessonNotFound_ShouldThrowException() {
            Exam exam = new Exam();
            ExamDTO request = new ExamDTO();
            request.setLessonId(999L);

            when(lessonRepository.findById(999L)).thenReturn(Optional.empty());

            ValidationContext ctx = new ValidationContext();
            assertThrows(ResourceNotFoundException.class, () -> service.apply(exam, request, ctx));
        }

        @Test
        @DisplayName("Should add error when lesson does not belong to provided sectionId")
        void apply_WhenLessonSectionMismatch_ShouldAddError() {
            Exam exam = new Exam();
            ExamDTO request = new ExamDTO();
            request.setLessonId(lesson1.getId());
            request.setSectionId(99L); // mismatch

            when(lessonRepository.findById(lesson1.getId())).thenReturn(Optional.of(lesson1));

            ValidationContext ctx = new ValidationContext();
            service.apply(exam, request, ctx);

            assertTrue(ctx.hasErrors());
            assertTrue(ctx.getErrors().containsKey("sectionId"));
        }

        @Test
        @DisplayName("Should add error when section does not belong to provided courseId")
        void apply_WhenSectionCourseMismatch_ShouldAddError() {
            Exam exam = new Exam();
            ExamDTO request = new ExamDTO();
            request.setSectionId(section1.getId());
            request.setCourseId(999L); // mismatch

            when(sectionRepository.findById(section1.getId())).thenReturn(Optional.of(section1));

            ValidationContext ctx = new ValidationContext();
            service.apply(exam, request, ctx);

            assertTrue(ctx.hasErrors());
            assertTrue(ctx.getErrors().containsKey("courseId"));
        }

        @Test
        @DisplayName("Should auto-derive course when only sectionId is provided")
        void apply_WhenSectionProvidedWithoutLesson_ShouldAutoDeriveCourse() {
            Exam exam = new Exam();
            ExamDTO request = new ExamDTO();
            request.setSectionId(section1.getId());

            when(sectionRepository.findById(section1.getId())).thenReturn(Optional.of(section1));

            ValidationContext ctx = new ValidationContext();
            service.apply(exam, request, ctx);

            assertFalse(ctx.hasErrors());
            assertEquals(section1, exam.getSection());
            assertEquals(course1, exam.getCourse());
            assertNull(exam.getLesson());
        }

        @Test
        @DisplayName("Should clear all links when courseId, sectionId, lessonId are explicitly set to null")
        void apply_WhenAllLinksNull_ShouldClearLinks() {
            Exam exam = createExam(1L, teacherUser.getId(), course1, section1, lesson1);
            ExamDTO request = new ExamDTO();
            request.setCourseId(null);
            request.setSectionId(null);
            request.setLessonId(null);

            ValidationContext ctx = new ValidationContext();
            service.apply(exam, request, ctx);

            assertFalse(ctx.hasErrors());
            assertNull(exam.getCourse());
            assertNull(exam.getSection());
            assertNull(exam.getLesson());
        }
    }

    // =========================================================================
    // listByCourse tests
    // =========================================================================

    @Nested
    @DisplayName("listByCourse tests")
    class ListByCourseTests {

        @Test
        @DisplayName("Should throw ResourceNotFoundException when course not found")
        void listByCourse_WhenCourseNotFound_ShouldThrowException() {
            when(courseRepository.findById(999L)).thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class,
                    () -> service.listByCourse(999L, null, null, teacherPrincipal));
        }

        @Test
        @DisplayName("Should return all exams with staff details when user is admin")
        void listByCourse_WhenAdmin_ShouldReturnAllExams() {
            when(courseRepository.findById(course1.getId())).thenReturn(Optional.of(course1));
            when(examAccessGuard.isAdmin(adminPrincipal)).thenReturn(true);

            Exam exam = createExam(1L, teacherUser.getId(), course1, section1, null);
            when(examRepository.findByCourseLink(course1.getId(), null, null, false))
                    .thenReturn(List.of(exam));
            when(userRepository.findById(teacherUser.getId())).thenReturn(Optional.of(teacherUser));

            List<CourseExamDTO> result = service.listByCourse(course1.getId(), null, null, adminPrincipal);

            assertEquals(1, result.size());
            assertEquals("Exam 1", result.get(0).title());
            assertEquals("Teacher One", result.get(0).createdByName());
        }

        @Test
        @DisplayName("Should return active exams only and hide staff details when student is enrolled")
        void listByCourse_WhenEnrolledStudent_ShouldReturnActiveOnly() {
            when(courseRepository.findById(course1.getId())).thenReturn(Optional.of(course1));
            when(examAccessGuard.isAdmin(studentPrincipal)).thenReturn(false);
            when(enrollmentRepository.existsByUser_IdAndCourse_Id(studentUser.getId(), course1.getId()))
                    .thenReturn(true);

            Exam exam = createExam(1L, teacherUser.getId(), course1, section1, null);
            when(examRepository.findByCourseLink(course1.getId(), null, null, true))
                    .thenReturn(List.of(exam));

            List<CourseExamDTO> result = service.listByCourse(course1.getId(), null, null, studentPrincipal);

            assertEquals(1, result.size());
            assertNull(result.get(0).createdByName());
            assertNull(result.get(0).questionCount());
        }

        @Test
        @DisplayName("Should throw AccessDeniedException when student is not enrolled")
        void listByCourse_WhenNotEnrolled_ShouldThrowException() {
            when(courseRepository.findById(course1.getId())).thenReturn(Optional.of(course1));
            when(examAccessGuard.isAdmin(studentPrincipal)).thenReturn(false);
            when(enrollmentRepository.existsByUser_IdAndCourse_Id(studentUser.getId(), course1.getId()))
                    .thenReturn(false);

            assertThrows(AccessDeniedException.class,
                    () -> service.listByCourse(course1.getId(), null, null, studentPrincipal));
        }
    }

    // =========================================================================
    // listBySection tests
    // =========================================================================

    @Nested
    @DisplayName("listBySection tests")
    class ListBySectionTests {

        @Test
        @DisplayName("Should throw ResourceNotFoundException when section not found")
        void listBySection_WhenSectionNotFound_ShouldThrowException() {
            when(sectionRepository.findById(999L)).thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class,
                    () -> service.listBySection(999L, teacherPrincipal));
        }

        @Test
        @DisplayName("Should query exams by section and course when access allowed")
        void listBySection_WhenAuthorized_ShouldReturnExams() {
            when(sectionRepository.findById(section1.getId())).thenReturn(Optional.of(section1));
            when(examAccessGuard.isAdmin(teacherPrincipal)).thenReturn(false);

            Exam exam = createExam(1L, teacherUser.getId(), course1, section1, null);
            when(examRepository.findByCourseLink(course1.getId(), section1.getId(), null, false))
                    .thenReturn(List.of(exam));
            when(userRepository.findById(teacherUser.getId())).thenReturn(Optional.of(teacherUser));

            List<CourseExamDTO> result = service.listBySection(section1.getId(), teacherPrincipal);

            assertEquals(1, result.size());
            assertEquals("Exam 1", result.get(0).title());
            verify(examRepository).findByCourseLink(course1.getId(), section1.getId(), null, false);
        }

        @Test
        @DisplayName("Should throw AccessDeniedException when non-enrolled user accesses section exams")
        void listBySection_WhenNotEnrolled_ShouldThrowException() {
            when(sectionRepository.findById(section1.getId())).thenReturn(Optional.of(section1));
            when(examAccessGuard.isAdmin(studentPrincipal)).thenReturn(false);
            when(enrollmentRepository.existsByUser_IdAndCourse_Id(studentUser.getId(), course1.getId()))
                    .thenReturn(false);

            assertThrows(AccessDeniedException.class,
                    () -> service.listBySection(section1.getId(), studentPrincipal));
        }
    }

    // =========================================================================
    // listByLesson tests
    // =========================================================================

    @Nested
    @DisplayName("listByLesson tests")
    class ListByLessonTests {

        @Test
        @DisplayName("Should throw ResourceNotFoundException when lesson not found")
        void listByLesson_WhenLessonNotFound_ShouldThrowException() {
            when(lessonRepository.findById(999L)).thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class,
                    () -> service.listByLesson(999L, teacherPrincipal));
        }

        @Test
        @DisplayName("Should query exams by lesson, section, and course when access allowed")
        void listByLesson_WhenAuthorized_ShouldReturnExams() {
            when(lessonRepository.findById(lesson1.getId())).thenReturn(Optional.of(lesson1));
            when(examAccessGuard.isAdmin(teacherPrincipal)).thenReturn(false);

            Exam exam = createExam(1L, teacherUser.getId(), course1, section1, lesson1);
            when(examRepository.findByCourseLink(course1.getId(), section1.getId(), lesson1.getId(), false))
                    .thenReturn(List.of(exam));
            when(userRepository.findById(teacherUser.getId())).thenReturn(Optional.of(teacherUser));

            List<CourseExamDTO> result = service.listByLesson(lesson1.getId(), teacherPrincipal);

            assertEquals(1, result.size());
            assertEquals("Exam 1", result.get(0).title());
            verify(examRepository).findByCourseLink(course1.getId(), section1.getId(), lesson1.getId(), false);
        }

        @Test
        @DisplayName("Should throw AccessDeniedException when non-enrolled user accesses lesson exams")
        void listByLesson_WhenNotEnrolled_ShouldThrowException() {
            when(lessonRepository.findById(lesson1.getId())).thenReturn(Optional.of(lesson1));
            when(examAccessGuard.isAdmin(studentPrincipal)).thenReturn(false);
            when(enrollmentRepository.existsByUser_IdAndCourse_Id(studentUser.getId(), course1.getId()))
                    .thenReturn(false);

            assertThrows(AccessDeniedException.class,
                    () -> service.listByLesson(lesson1.getId(), studentPrincipal));
        }
    }

    // =========================================================================
    // linkExam tests (preserving Exam Owner authorization)
    // =========================================================================

    @Nested
    @DisplayName("linkExam tests")
    class LinkExamTests {

        @Test
        @DisplayName("Should throw AccessDeniedException when user is not the exam owner and not admin")
        void linkExam_WhenUserCannotManageExam_ShouldThrowException() {
            when(courseRepository.findById(course1.getId())).thenReturn(Optional.of(course1));
            Exam examOwnedByOther = createExam(2L, otherTeacherUser.getId(), null, null, null);
            when(examRepository.findById(2L)).thenReturn(Optional.of(examOwnedByOther));
            when(examAccessGuard.canManage(examOwnedByOther, teacherPrincipal)).thenReturn(false);

            assertThrows(AccessDeniedException.class,
                    () -> service.linkExam(course1.getId(), 2L, null, null, teacherPrincipal));
        }

        @Test
        @DisplayName("Should throw AccessDeniedException when teacher does not teach the target course")
        void linkExam_WhenTeacherDoesNotTeachCourse_ShouldThrowException() {
            when(courseRepository.findById(course2.getId())).thenReturn(Optional.of(course2));
            when(examAccessGuard.isOwnerScoped(teacherPrincipal)).thenReturn(true);

            assertThrows(AccessDeniedException.class,
                    () -> service.linkExam(course2.getId(), 1L, null, null, teacherPrincipal));
        }

        @Test
        @DisplayName("Should throw IllegalArgumentException when lesson does not belong to course")
        void linkExam_WhenLessonDoesNotBelongToCourse_ShouldThrowException() {
            when(courseRepository.findById(course2.getId())).thenReturn(Optional.of(course2));
            when(examAccessGuard.isOwnerScoped(otherTeacherPrincipal)).thenReturn(true);
            Exam exam = createExam(2L, otherTeacherUser.getId(), null, null, null);
            when(examRepository.findById(2L)).thenReturn(Optional.of(exam));
            when(examAccessGuard.canManage(exam, otherTeacherPrincipal)).thenReturn(true);

            // lesson1 belongs to section1 -> course1, not course2
            when(lessonRepository.findById(lesson1.getId())).thenReturn(Optional.of(lesson1));

            assertThrows(IllegalArgumentException.class,
                    () -> service.linkExam(course2.getId(), 2L, null, lesson1.getId(), otherTeacherPrincipal));
        }

        @Test
        @DisplayName("Should successfully link exam when teacher is owner and teaches course")
        void linkExam_WhenValid_ShouldLinkAndSave() {
            when(courseRepository.findById(course1.getId())).thenReturn(Optional.of(course1));
            when(examAccessGuard.isOwnerScoped(teacherPrincipal)).thenReturn(true);
            Exam exam = createExam(1L, teacherUser.getId(), null, null, null);
            when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
            when(examAccessGuard.canManage(exam, teacherPrincipal)).thenReturn(true);
            when(sectionRepository.findById(section1.getId())).thenReturn(Optional.of(section1));
            when(examRepository.save(exam)).thenReturn(exam);
            when(userRepository.findById(teacherUser.getId())).thenReturn(Optional.of(teacherUser));

            CourseExamDTO result = service.linkExam(course1.getId(), 1L, section1.getId(), null, teacherPrincipal);

            assertNotNull(result);
            assertEquals(course1.getId(), exam.getCourse().getId());
            assertEquals(section1.getId(), exam.getSection().getId());
            assertNull(exam.getLesson());
            verify(examRepository).save(exam);
        }

        @Test
        @DisplayName("Admin can link any exam to any course")
        void linkExam_WhenAdmin_ShouldAllowLinking() {
            when(courseRepository.findById(course1.getId())).thenReturn(Optional.of(course1));
            when(examAccessGuard.isOwnerScoped(adminPrincipal)).thenReturn(false);
            Exam exam = createExam(1L, teacherUser.getId(), null, null, null);
            when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
            when(examAccessGuard.canManage(exam, adminPrincipal)).thenReturn(true);
            when(examRepository.save(exam)).thenReturn(exam);
            when(examAccessGuard.isAdmin(adminPrincipal)).thenReturn(true);
            when(userRepository.findById(teacherUser.getId())).thenReturn(Optional.of(teacherUser));

            CourseExamDTO result = service.linkExam(course1.getId(), 1L, null, null, adminPrincipal);

            assertNotNull(result);
            assertEquals(course1, exam.getCourse());
            verify(examRepository).save(exam);
        }
    }

    // =========================================================================
    // unlinkExam tests
    // =========================================================================

    @Nested
    @DisplayName("unlinkExam tests")
    class UnlinkExamTests {

        @Test
        @DisplayName("Should throw AccessDeniedException when teacher does not own the exam")
        void unlinkExam_WhenNotOwner_ShouldThrowException() {
            when(courseRepository.findById(course1.getId())).thenReturn(Optional.of(course1));
            Exam exam = createExam(2L, otherTeacherUser.getId(), course1, section1, null);
            when(examRepository.findById(2L)).thenReturn(Optional.of(exam));
            when(examAccessGuard.canManage(exam, teacherPrincipal)).thenReturn(false);

            assertThrows(AccessDeniedException.class,
                    () -> service.unlinkExam(course1.getId(), 2L, false, teacherPrincipal));
        }

        @Test
        @DisplayName("Should throw IllegalArgumentException when exam is not linked to specified course")
        void unlinkExam_WhenCourseMismatch_ShouldThrowException() {
            when(courseRepository.findById(course1.getId())).thenReturn(Optional.of(course1));
            when(examAccessGuard.isOwnerScoped(teacherPrincipal)).thenReturn(true);
            Exam exam = createExam(1L, teacherUser.getId(), course2, null, null); // linked to course2
            when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
            when(examAccessGuard.canManage(exam, teacherPrincipal)).thenReturn(true);

            assertThrows(IllegalArgumentException.class,
                    () -> service.unlinkExam(course1.getId(), 1L, false, teacherPrincipal));
        }

        @Test
        @DisplayName("Should clear course, section, and lesson when unlinkFromCourse is true")
        void unlinkExam_WhenUnlinkFromCourseTrue_ShouldClearAll() {
            when(courseRepository.findById(course1.getId())).thenReturn(Optional.of(course1));
            when(examAccessGuard.isOwnerScoped(teacherPrincipal)).thenReturn(true);
            Exam exam = createExam(1L, teacherUser.getId(), course1, section1, lesson1);
            when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
            when(examAccessGuard.canManage(exam, teacherPrincipal)).thenReturn(true);

            service.unlinkExam(course1.getId(), 1L, true, teacherPrincipal);

            assertNull(exam.getCourse());
            assertNull(exam.getSection());
            assertNull(exam.getLesson());
            verify(examRepository).save(exam);
        }

        @Test
        @DisplayName("Should clear section and lesson only when unlinkFromCourse is false")
        void unlinkExam_WhenUnlinkFromCourseFalse_ShouldKeepCourse() {
            when(courseRepository.findById(course1.getId())).thenReturn(Optional.of(course1));
            when(examAccessGuard.isOwnerScoped(teacherPrincipal)).thenReturn(true);
            Exam exam = createExam(1L, teacherUser.getId(), course1, section1, lesson1);
            when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
            when(examAccessGuard.canManage(exam, teacherPrincipal)).thenReturn(true);

            service.unlinkExam(course1.getId(), 1L, false, teacherPrincipal);

            assertEquals(course1, exam.getCourse());
            assertNull(exam.getSection());
            assertNull(exam.getLesson());
            verify(examRepository).save(exam);
        }
    }

    // =========================================================================
    // availableExams tests
    // =========================================================================

    @Nested
    @DisplayName("availableExams tests")
    class AvailableExamsTests {

        @Test
        @DisplayName("Teacher should only see their own exams as available to link")
        void availableExams_WhenTeacher_ShouldReturnOnlyOwnExams() {
            when(courseRepository.findById(course1.getId())).thenReturn(Optional.of(course1));
            when(examAccessGuard.isOwnerScoped(teacherPrincipal)).thenReturn(true);
            when(examAccessGuard.isAdmin(teacherPrincipal)).thenReturn(false);

            Exam exam1 = createExam(1L, teacherUser.getId(), null, null, null);
            Exam exam2 = createExam(2L, otherTeacherUser.getId(), null, null, null);

            when(examRepository.findAll()).thenReturn(List.of(exam1, exam2));
            when(userRepository.findById(teacherUser.getId())).thenReturn(Optional.of(teacherUser));

            List<CourseExamDTO> available = service.availableExams(course1.getId(), teacherPrincipal);

            assertEquals(1, available.size());
            assertEquals(1L, available.get(0).id());
        }

        @Test
        @DisplayName("Admin can see all available exams")
        void availableExams_WhenAdmin_ShouldReturnAll() {
            when(courseRepository.findById(course1.getId())).thenReturn(Optional.of(course1));
            when(examAccessGuard.isOwnerScoped(adminPrincipal)).thenReturn(false);
            when(examAccessGuard.isAdmin(adminPrincipal)).thenReturn(true);

            Exam exam1 = createExam(1L, teacherUser.getId(), null, null, null);
            Exam exam2 = createExam(2L, otherTeacherUser.getId(), null, null, null);

            when(examRepository.findAll()).thenReturn(List.of(exam1, exam2));
            when(userRepository.findById(teacherUser.getId())).thenReturn(Optional.of(teacherUser));
            when(userRepository.findById(otherTeacherUser.getId())).thenReturn(Optional.of(otherTeacherUser));

            List<CourseExamDTO> available = service.availableExams(course1.getId(), adminPrincipal);

            assertEquals(2, available.size());
        }
    }
}
