package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CourseContentAccessGuard {

    private final CourseEnrollmentRepository enrollmentRepository;

    public boolean isOwner(Course course, Long userId) {
        return userId != null
                && course.getInstructorUser() != null
                && userId.equals(course.getInstructorUser().getId());
    }

    public boolean canAccess(Course course, Long userId, boolean administrator) {
        boolean enrolled = userId != null
                && enrollmentRepository.existsByUser_IdAndCourse_Id(userId, course.getId());
        return canAccess(course, userId, administrator, enrolled);
    }

    public boolean canAccess(
            Course course,
            Long userId,
            boolean administrator,
            boolean enrolled
    ) {
        return administrator
                || isOwner(course, userId)
                || Boolean.TRUE.equals(course.getIsFree())
                || enrolled;
    }
}
