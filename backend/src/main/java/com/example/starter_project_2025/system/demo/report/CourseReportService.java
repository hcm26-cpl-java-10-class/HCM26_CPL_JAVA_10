package com.example.starter_project_2025.system.demo.report;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.demo.certificate.CertificateRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CourseReportService {

    private final CourseReportRepository courseReportRepository;
    private final LessonRepository lessonRepository;
    private final LessonProgressRepository lessonProgressRepository;
    private final CertificateRepository certificateRepository;

    @Transactional(readOnly = true)
    public List<CourseReportDTO> getCourseReport() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        List<Course> courses = getCoursesForCurrentUser(auth);

        List<CourseReportDTO> result = new ArrayList<>();

        for (Course course : courses) {
            List<CourseEnrollment> enrollments = courseReportRepository.findByCourseIdWithUser(course.getId())
                    .stream()
                    .filter(enrollment -> !Boolean.FALSE.equals(enrollment.getIsActive()))
                    .toList();

            int lessonCount = lessonRepository.findActiveByCourseIdOrdered(course.getId()).size();
            List<CourseLearnerReportDTO> learners = enrollments.stream()
                    .map(enrollment -> {
                        long completedLessons = lessonProgressRepository.findAllByEnrollment_Id(enrollment.getId())
                                .stream()
                                .filter(progress -> progress.isCompleted())
                                .count();
                        int percentage = lessonCount == 0
                                ? 0
                                : (int) Math.round(completedLessons * 100.0 / lessonCount);
                        return CourseLearnerReportDTO.builder()
                                .enrollmentId(enrollment.getId())
                                .studentName(enrollment.getUser().getFullName())
                                .studentEmail(enrollment.getUser().getEmail())
                                .progressPercentage(percentage)
                                .completed(percentage == 100)
                                .enrolledAt(enrollment.getCreatedAt())
                                .build();
                    })
                    .toList();

            List<String> studentNames = enrollments.stream()
                    .map(enrollment -> enrollment.getUser())
                    .filter(user -> user != null)
                    .map(user -> user.getFullName())
                    .filter(name -> name != null && !name.isBlank())
                    .distinct()
                    .sorted(String::compareToIgnoreCase)
                    .toList();

            long completedLearners = learners.stream().filter(CourseLearnerReportDTO::isCompleted).count();
            int averageProgress = learners.isEmpty()
                    ? 0
                    : (int) Math.round(learners.stream().mapToInt(CourseLearnerReportDTO::getProgressPercentage).average().orElse(0));
            int completionRate = learners.isEmpty()
                    ? 0
                    : (int) Math.round(completedLearners * 100.0 / learners.size());

            result.add(CourseReportDTO.builder()
                    .courseId(course.getId())
                    .courseName(course.getName())
                    .instructor(course.getInstructor())
                    .courseStatus(course.getStatus() != null
                            ? course.getStatus().name()
                            : CourseStatus.DRAFT.name())
                    .studentCount((long) studentNames.size())
                    .students(studentNames)
                    .categories(course.getCategories().stream()
                            .map(category -> category.getName())
                            .filter(name -> name != null && !name.isBlank())
                            .sorted(String::compareToIgnoreCase)
                            .toList())
                    .courseLevel(course.getLevel() == null ? null : course.getLevel().name())
                    .averageProgress(averageProgress)
                    .activeLearners(learners.size() - completedLearners)
                    .completedLearners(completedLearners)
                    .completionRate(completionRate)
                    .certificatesIssued(certificateRepository.findUserIdsByCourseId(course.getId()).size())
                    .learners(learners)
                    .build());
        }

        result.sort(Comparator.comparing(
                CourseReportDTO::getCourseName,
                Comparator.nullsLast(String::compareToIgnoreCase)
        ));

        return result;
    }

    private List<Course> getCoursesForCurrentUser(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return Collections.emptyList();
        }

        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()) || "ADMIN".equals(a.getAuthority()));

        if (isAdmin) {
            return courseReportRepository.findAllCoursesWithMeta();
        }

        Object principal = auth.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            User user = userPrincipal.getUser();
            Long userId = user.getId();
            String fullName = (user.getFullName() != null && !user.getFullName().isBlank())
                    ? user.getFullName().trim()
                    : "___NON_EXISTING___";
            String email = (user.getEmail() != null && !user.getEmail().isBlank())
                    ? user.getEmail().trim()
                    : "___NON_EXISTING___";

            return courseReportRepository.findCoursesByTeacher(userId, fullName, email);
        }

        return Collections.emptyList();
    }
}
