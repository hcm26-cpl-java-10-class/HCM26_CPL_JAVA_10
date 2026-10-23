package com.example.starter_project_2025.system.demo.report;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
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

    @Transactional(readOnly = true)
    public List<CourseReportDTO> getCourseReport() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        List<Course> courses = getCoursesForCurrentUser(auth);

        List<CourseReportDTO> result = new ArrayList<>();

        for (Course course : courses) {
            List<CourseEnrollment> enrollments =
                    courseReportRepository.findByCourseIdWithUser(course.getId());

            List<String> studentNames = enrollments.stream()
                    .map(enrollment -> enrollment.getUser())
                    .filter(user -> user != null)
                    .map(user -> user.getFullName())
                    .filter(name -> name != null && !name.isBlank())
                    .distinct()
                    .sorted(String::compareToIgnoreCase)
                    .toList();

            result.add(CourseReportDTO.builder()
                    .courseId(course.getId())
                    .courseName(course.getName())
                    .instructor(course.getInstructor())
                    .courseStatus(course.getStatus() != null
                            ? course.getStatus().name()
                            : CourseStatus.DRAFT.name())
                    .studentCount((long) studentNames.size())
                    .students(studentNames)
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
