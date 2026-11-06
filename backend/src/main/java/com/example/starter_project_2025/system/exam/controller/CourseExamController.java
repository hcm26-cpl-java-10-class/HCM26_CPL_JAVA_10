package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.CourseExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamLinkOptionDTO;
import com.example.starter_project_2025.system.exam.service.ExamCourseLinkService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
