package com.example.starter_project_2025.system.demo.enrollment;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CourseEnrollmentService {

    private final CourseEnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final UserRepository userRepository;

    @Transactional
    public CourseEnrollment enroll(Long userId, Long courseId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() ->
                        new RuntimeException("Course not found"));

        if (enrollmentRepository.existsByUser_IdAndCourse_Id(
                userId, courseId)) {
            throw new RuntimeException(
                    "You are already enrolled in this course");
        }

        CourseEnrollment enrollment = CourseEnrollment.builder()
                .user(user)
                .course(course)
                .build();

        return enrollmentRepository.save(enrollment);
    }

    @Transactional(readOnly = true)
    public List<CourseEnrollment> getMyCourses(Long userId) {
        return enrollmentRepository
                .findAllByUser_IdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public void cancelEnrollment(Long userId, Long enrollmentId) {
        CourseEnrollment enrollment = enrollmentRepository
                .findByIdAndUser_Id(enrollmentId, userId)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Enrollment not found"));

        enrollmentRepository.delete(enrollment);
    }
}