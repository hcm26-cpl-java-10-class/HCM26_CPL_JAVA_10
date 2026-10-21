package com.example.starter_project_2025.system.demo.enrollment;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.department.Department;
import com.example.starter_project_2025.system.demo.department.DepartmentRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CourseEnrollmentService {

    private final CourseEnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;

    @Transactional
    public CourseEnrollment enroll(Long userId, Long courseId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() ->
                        new RuntimeException("Course not found"));

        if (course.getStatus() != CourseStatus.PUBLISHED || !Boolean.TRUE.equals(course.getIsActive())) {
            throw new BadRequestException("This course is not available for enrollment");
        }

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

    @Transactional(readOnly = true)
    public DepartmentEnrollmentPreviewDTO previewDepartmentEnrollment(
            Long departmentId,
            Long courseId
    ) {
        Department department = getDepartment(departmentId);
        Course course = getAvailableCourse(courseId);
        long students = userRepository.countActiveStudentsByDepartmentId(department.getId());
        long alreadyEnrolled = enrollmentRepository
                .countEnrolledStudentsByDepartmentAndCourse(department.getId(), course.getId());

        return new DepartmentEnrollmentPreviewDTO(
                department.getId(),
                course.getId(),
                course.getName(),
                students,
                alreadyEnrolled,
                students - alreadyEnrolled
        );
    }

    @Transactional
    public DepartmentEnrollmentResultDTO enrollDepartment(
            Long departmentId,
            Long courseId
    ) {
        Department department = getDepartment(departmentId);
        Course course = getAvailableCourse(courseId);
        List<User> students = userRepository.findActiveStudentsByDepartmentId(department.getId());
        Set<Long> enrolledUserIds = new HashSet<>(
                enrollmentRepository.findEnrolledUserIdsByDepartmentAndCourse(
                        department.getId(), course.getId()));

        List<CourseEnrollment> newEnrollments = new ArrayList<>();
        for (User student : students) {
            if (!enrolledUserIds.contains(student.getId())) {
                CourseEnrollment enrollment = new CourseEnrollment();
                enrollment.setUser(student);
                enrollment.setCourse(course);
                newEnrollments.add(enrollment);
            }
        }
        enrollmentRepository.saveAll(newEnrollments);

        return new DepartmentEnrollmentResultDTO(
                department.getId(),
                course.getId(),
                course.getName(),
                students.size(),
                enrolledUserIds.size(),
                newEnrollments.size()
        );
    }

    private Department getDepartment(Long departmentId) {
        return departmentRepository.findById(departmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found"));
    }

    private Course getAvailableCourse(Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        if (course.getStatus() != CourseStatus.PUBLISHED
                || !Boolean.TRUE.equals(course.getIsActive())) {
            throw new BadRequestException("This course is not available for enrollment");
        }
        return course;
    }
}