package com.example.starter_project_2025.system.demo.course;
import com.example.starter_project_2025.system.demo.enrollment.*;
import com.example.starter_project_2025.system.demo.lesson.*;
import com.example.starter_project_2025.system.demo.progress.*;
import com.example.starter_project_2025.system.demo.certificate.CertificateService;
import com.example.starter_project_2025.system.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Service @RequiredArgsConstructor
public class CourseAssessmentCompletionService {
    private final CourseAssessmentService grades;
    private final CourseEnrollmentRepository enrollments;
    private final LessonRepository lessons;
    private final LessonProgressRepository progress;
    private final CertificateService certificates;
    private final NotificationService notifications;
    private final com.example.starter_project_2025.system.demo.coursepolicy.CourseCompletionRuleService rules;
    @Transactional
    public void refreshCourse(Long courseId) {
        for (CourseEnrollment enrollment:enrollments.findActiveStudentsByCourse(courseId)) refresh(enrollment);
    }
    public void refresh(CourseEnrollment enrollment) {
        var active=lessons.findByCourseIdOrdered(enrollment.getCourse().getId()).stream().filter(com.example.starter_project_2025.system.demo.course.CourseAssessmentService::activeLesson).toList();
        for (Lesson lesson:active) if (CourseAssessmentService.isAssessment(lesson) && grades.lessonFinished(lesson,enrollment.getUser().getId())) {
            LessonProgress item=progress.findByEnrollment_IdAndLesson_Id(enrollment.getId(),lesson.getId())
                    .orElseGet(()->LessonProgress.builder().enrollment(enrollment).lesson(lesson).build());
            if (!item.isCompleted()) { item.setCompleted(true);item.setCompletedAt(LocalDateTime.now());progress.save(item); }
        }
        var done=progress.findAllByEnrollment_Id(enrollment.getId()).stream().filter(LessonProgress::isCompleted).map(p->p.getLesson().getId()).toList();
        int completedActive=(int) active.stream().filter(l->done.contains(l.getId())).count();
        Long courseId=enrollment.getCourse().getId(), studentId=enrollment.getUser().getId();
        if (rules.isComplete(courseId,active.size(),completedActive,()->grades.canComplete(courseId,studentId))) {
            certificates.issueIfCourseCompleted(enrollment);
            notifications.createOnce(enrollment.getUser().getId(),"course-completed:"+enrollment.getId(),"Course completed",
                    "You completed "+enrollment.getCourse().getName()+".","/courses/"+enrollment.getCourse().getId());
        }
    }
}
