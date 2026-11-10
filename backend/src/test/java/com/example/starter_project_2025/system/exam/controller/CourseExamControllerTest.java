package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamType;
import com.example.starter_project_2025.system.exam.dto.CourseExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamLinkOptionDTO;
import com.example.starter_project_2025.system.exam.service.ExamCourseLinkService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CourseExamControllerTest {

    @Mock
    private ExamCourseLinkService linkService;

    @InjectMocks
    private CourseExamController controller;

    private final CourseExamDTO sampleExam = new CourseExamDTO(
            1L,
            "Test Exam",
            ExamCategory.ASSIGNMENT,
            ExamType.MIXED,
            60,
            1,
            BigDecimal.TEN,
            BigDecimal.valueOf(5),
            true,
            100L,
            10L,
            "Section 1",
            5L,
            "Lesson 1",
            10,
            "Teacher One",
            false,
            null
    );

    @Test
    @DisplayName("listByCourse should delegate to linkService.listByCourse")
    void listByCourse_ShouldDelegate() {
        UserPrincipal principal = mock(UserPrincipal.class);
        when(linkService.listByCourse(100L, 10L, 5L, principal)).thenReturn(List.of(sampleExam));

        List<CourseExamDTO> result = controller.listByCourse(100L, 10L, 5L, principal);

        assertEquals(1, result.size());
        assertEquals("Test Exam", result.get(0).title());
        verify(linkService).listByCourse(100L, 10L, 5L, principal);
    }

    @Test
    @DisplayName("listBySection should delegate to linkService.listBySection")
    void listBySection_ShouldDelegate() {
        UserPrincipal principal = mock(UserPrincipal.class);
        when(linkService.listBySection(10L, principal)).thenReturn(List.of(sampleExam));

        List<CourseExamDTO> result = controller.listBySection(10L, principal);

        assertEquals(1, result.size());
        assertEquals(10L, result.get(0).sectionId());
        verify(linkService).listBySection(10L, principal);
    }

    @Test
    @DisplayName("listByLesson should delegate to linkService.listByLesson")
    void listByLesson_ShouldDelegate() {
        UserPrincipal principal = mock(UserPrincipal.class);
        when(linkService.listByLesson(5L, principal)).thenReturn(List.of(sampleExam));

        List<CourseExamDTO> result = controller.listByLesson(5L, principal);

        assertEquals(1, result.size());
        assertEquals(5L, result.get(0).lessonId());
        verify(linkService).listByLesson(5L, principal);
    }

    @Test
    @DisplayName("linkExam should delegate to linkService.linkExam and return 200 OK")
    void linkExam_ShouldDelegate() {
        UserPrincipal principal = mock(UserPrincipal.class);
        when(linkService.linkExam(100L, 1L, 10L, 5L, principal)).thenReturn(sampleExam);

        ResponseEntity<CourseExamDTO> response = controller.linkExam(100L, 1L, 10L, 5L, principal);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(sampleExam, response.getBody());
        verify(linkService).linkExam(100L, 1L, 10L, 5L, principal);
    }

    @Test
    @DisplayName("unlinkExam should delegate to linkService.unlinkExam and return 204 No Content")
    void unlinkExam_ShouldDelegate() {
        UserPrincipal principal = mock(UserPrincipal.class);

        ResponseEntity<Void> response = controller.unlinkExam(100L, 1L, true, principal);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(linkService).unlinkExam(100L, 1L, true, principal);
    }

    @Test
    @DisplayName("availableExams should delegate to linkService.availableExams")
    void availableExams_ShouldDelegate() {
        UserPrincipal principal = mock(UserPrincipal.class);
        when(linkService.availableExams(100L, principal)).thenReturn(List.of(sampleExam));

        List<CourseExamDTO> result = controller.availableExams(100L, principal);

        assertEquals(1, result.size());
        verify(linkService).availableExams(100L, principal);
    }
}
