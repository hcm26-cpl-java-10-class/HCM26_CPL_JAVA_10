package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.CourseExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamLinkOptionDTO;
import com.example.starter_project_2025.system.exam.service.ExamCourseLinkService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Bai thi theo course/section/lesson va cac lua chon cho o chon lien ket trong form bai thi. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CourseExamController {

    private final ExamCourseLinkService linkService;

    /** Bai thi cua mot course (loc them theo section / lesson). Giang vien course, admin, sinh vien da ghi danh. */
    @GetMapping("/courses/{courseId}/exams")
    @PreAuthorize("isAuthenticated()")
    public List<CourseExamDTO> listByCourse(
            @PathVariable Long courseId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) Long lessonId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return linkService.listByCourse(courseId, sectionId, lessonId, principal);
    }

    /** Danh sach bai thi thuoc mot section. Giang vien course, admin, hoac sinh vien da ghi danh. */
    @GetMapping("/sections/{sectionId}/exams")
    @PreAuthorize("isAuthenticated()")
    public List<CourseExamDTO> listBySection(
            @PathVariable Long sectionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return linkService.listBySection(sectionId, principal);
    }

    /** Danh sach bai thi thuoc mot lesson. Giang vien course, admin, hoac sinh vien da ghi danh. */
    @GetMapping("/lessons/{lessonId}/exams")
    @PreAuthorize("isAuthenticated()")
    public List<CourseExamDTO> listByLesson(
            @PathVariable Long lessonId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return linkService.listByLesson(lessonId, principal);
    }

    /** Gan mot bai thi vao course / section / lesson */
    @PutMapping("/courses/{courseId}/exams/{examId}/link")
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<CourseExamDTO> linkExam(
            @PathVariable Long courseId,
            @PathVariable Long examId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) Long lessonId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(linkService.linkExam(courseId, examId, sectionId, lessonId, principal));
    }

    /** Go mot bai thi khoi section / lesson (hoac go khoi course) */
    @DeleteMapping("/courses/{courseId}/exams/{examId}/link")
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<Void> unlinkExam(
            @PathVariable Long courseId,
            @PathVariable Long examId,
            @RequestParam(required = false, defaultValue = "false") boolean unlinkFromCourse,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        linkService.unlinkExam(courseId, examId, unlinkFromCourse, principal);
        return ResponseEntity.noContent().build();
    }

    /** Danh sach bai thi co the gan vao course nay */
    @GetMapping("/courses/{courseId}/exams/available")
    @PreAuthorize("hasAuthority('EXAM_READ')")
    public List<CourseExamDTO> availableExams(
            @PathVariable Long courseId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return linkService.availableExams(courseId, principal);
    }

    @GetMapping("/exams/link-options/courses")
    @PreAuthorize("hasAuthority('EXAM_READ')")
    public List<ExamLinkOptionDTO> courses() {
        return linkService.courseOptions();
    }

    @GetMapping("/exams/link-options/courses/{courseId}/sections")
    @PreAuthorize("hasAuthority('EXAM_READ')")
    public List<ExamLinkOptionDTO> sections(@PathVariable Long courseId) {
        return linkService.sectionOptions(courseId);
    }

    @GetMapping("/exams/link-options/sections/{sectionId}/lessons")
    @PreAuthorize("hasAuthority('EXAM_READ')")
    public List<ExamLinkOptionDTO> lessons(@PathVariable Long sectionId) {
        return linkService.lessonOptions(sectionId);
    }
}
