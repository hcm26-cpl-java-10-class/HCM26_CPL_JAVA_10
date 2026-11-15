package com.example.starter_project_2025.system.demo.course;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.exam.service.ExamCourseLinkService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@RestController @RequiredArgsConstructor @RequestMapping("/api/courses") @Transactional(readOnly=true)
public class CourseAssessmentController {
    private final CourseRepository courses;
    private final CourseAssessmentService assessments;
    private final ExamCourseLinkService links;
    private final CourseEnrollmentRepository enrollments;
    public record Result(Long studentId,String studentName,String studentEmail,CourseAssessmentService.Grade grade) {}
    @GetMapping("/{id}/assessment-plan")
    @PreAuthorize("hasAuthority('COURSE_UPDATE') or hasAuthority('EXAM_READ')")
    public CourseAssessmentService.Plan plan(@PathVariable Long id,@AuthenticationPrincipal UserPrincipal principal) {
        staff(id,principal); return assessments.plan(id);
    }
    @GetMapping("/{id}/assessment-results")
    @PreAuthorize("hasAuthority('COURSE_REPORT_READ') or hasAuthority('EXAM_READ')")
    public List<Result> results(@PathVariable Long id,@AuthenticationPrincipal UserPrincipal principal) {
        staff(id,principal);
        return enrollments.findActiveStudentsByCourse(id).stream()
                .map(e->new Result(e.getUser().getId(),e.getUser().getFullName(),e.getUser().getEmail(),assessments.grade(id,e.getUser().getId()))).toList();
    }
    private void staff(Long id,UserPrincipal principal) {
        Course course=courses.findById(id).orElseThrow(()->new ResourceNotFoundException("Course not found"));
        if (!links.checkCourseAccess(course,principal)) throw new AccessDeniedException("Only the course instructor or an administrator can view course assessment results");
    }
}
