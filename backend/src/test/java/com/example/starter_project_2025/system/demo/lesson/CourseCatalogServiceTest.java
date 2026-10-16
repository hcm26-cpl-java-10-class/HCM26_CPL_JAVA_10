package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.category.CategoryRepository;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseCatalogServiceTest {

    @Mock
    CourseRepository courseRepository;
    @Mock
    CategoryRepository categoryRepository;
    @Mock
    SectionRepository sectionRepository;
    @Mock
    LessonRepository lessonRepository;
    @Mock
    CourseEnrollmentRepository enrollmentRepository;

    CourseCatalogService service;

    Course course;
    Section section;
    Lesson lesson;

    @BeforeEach
    void setUp() {
        course = Course.builder()
                .id(10L)
                .name("Java 21")
                .status(CourseStatus.PUBLISHED)
                .isFree(false)
                .build();
        section = Section.builder().id(20L).course(course).title("Intro").orderIndex(0).build();
        lesson = Lesson.builder()
                .id(30L)
                .section(section)
                .title("Welcome")
                .contentType(LessonContentType.VIDEO)
                .contentUrl("https://example.com/video.mp4")
                .textContent("secret text")
                .duration(120)
                .orderIndex(0)
                .build();
        service = new CourseCatalogService(
                courseRepository,
                categoryRepository,
                sectionRepository,
                lessonRepository,
                enrollmentRepository,
                new CourseContentAccessGuard(enrollmentRepository)
        );
    }

    private void stubCourseContent() {
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(sectionRepository.findByCourse_IdOrderByOrderIndexAsc(10L)).thenReturn(List.of(section));
        when(lessonRepository.findActiveByCourseIdOrdered(10L)).thenReturn(List.of(lesson));
    }

    @Test
    void hidesLessonContentWhenNotEnrolled() {
        stubCourseContent();
        when(enrollmentRepository.existsByUser_IdAndCourse_Id(7L, 10L)).thenReturn(false);

        CourseDetailDTO detail = service.getDetail(10L, 7L, false);

        CourseDetailDTO.LessonItem item = detail.sections().getFirst().lessons().getFirst();
        assertFalse(detail.enrolled());
        assertFalse(detail.contentUnlocked());
        assertTrue(item.locked());
        assertNull(item.contentUrl());
        assertNull(item.textContent());
        // metadata vẫn hiển thị
        assertEquals("Welcome", item.title());
        assertEquals(120, item.duration());
        assertEquals(1, detail.lessonCount());
        assertEquals(120L, detail.totalDuration());
    }

    @Test
    void showsLessonContentWhenEnrolled() {
        stubCourseContent();
        when(enrollmentRepository.existsByUser_IdAndCourse_Id(7L, 10L)).thenReturn(true);

        CourseDetailDTO detail = service.getDetail(10L, 7L, false);

        CourseDetailDTO.LessonItem item = detail.sections().getFirst().lessons().getFirst();
        assertTrue(detail.enrolled());
        assertTrue(detail.contentUnlocked());
        assertFalse(item.locked());
        assertEquals("https://example.com/video.mp4", item.contentUrl());
        assertEquals("secret text", item.textContent());
    }

    @Test
    void administratorSeesContentWithoutEnrollment() {
        stubCourseContent();
        when(enrollmentRepository.existsByUser_IdAndCourse_Id(7L, 10L)).thenReturn(false);

        CourseDetailDTO detail = service.getDetail(10L, 7L, true);

        assertFalse(detail.enrolled());
        assertTrue(detail.contentUnlocked());
        assertNotNull(detail.sections().getFirst().lessons().getFirst().contentUrl());
    }

    @Test
    void freeCourseContentIsAvailableWithoutEnrollment() {
        course.setIsFree(true);
        stubCourseContent();
        when(enrollmentRepository.existsByUser_IdAndCourse_Id(7L, 10L)).thenReturn(false);

        CourseDetailDTO detail = service.getDetail(10L, 7L, false);

        assertTrue(detail.isFree());
        assertFalse(detail.enrolled());
        assertTrue(detail.contentUnlocked());
        assertEquals("https://example.com/video.mp4",
                detail.sections().getFirst().lessons().getFirst().contentUrl());
    }

    @Test
    void courseOwnerCanAccessDraftCourseContent() {
        course.setStatus(CourseStatus.DRAFT);
        course.setInstructorUser(User.builder().id(7L).build());
        stubCourseContent();
        when(enrollmentRepository.existsByUser_IdAndCourse_Id(7L, 10L)).thenReturn(false);

        CourseDetailDTO detail = service.getDetail(10L, 7L, false);

        assertTrue(detail.contentUnlocked());
        assertNotNull(detail.sections().getFirst().lessons().getFirst().contentUrl());
    }

    @Test
    void draftCourseIsNotFoundForNormalUsers() {
        course.setStatus(CourseStatus.DRAFT);
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));

        assertThrows(ResourceNotFoundException.class, () -> service.getDetail(10L, 7L, false));
    }

    @Test
    void draftCourseIsVisibleForStaff() {
        course.setStatus(CourseStatus.DRAFT);
        stubCourseContent();
        when(enrollmentRepository.existsByUser_IdAndCourse_Id(7L, 10L)).thenReturn(false);

        assertEquals(10L, service.getDetail(10L, 7L, true).id());
    }
}
