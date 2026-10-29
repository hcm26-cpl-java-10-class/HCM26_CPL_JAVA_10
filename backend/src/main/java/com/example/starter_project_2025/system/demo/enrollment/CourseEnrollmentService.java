package com.example.starter_project_2025.system.demo.enrollment;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.department.Department;
import com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO;
import com.example.starter_project_2025.system.demo.department.DepartmentRepository;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CourseEnrollmentService {

    private final CourseEnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final LessonRepository lessonRepository;
    private final LessonProgressRepository progressRepository;
    private final NotificationService notificationService;

    @Transactional
    public CourseEnrollment enroll(Long userId, Long courseId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("User not found"));

        Course course = getAvailableCourse(courseId);

        return createEnrollment(user, course);
    }

    @Transactional
    public CourseEnrollment enrollStudent(
            Long studentId,
            Long courseId
    ) {
        User student = userRepository.findById(studentId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Student not found"));
        if (!Boolean.TRUE.equals(student.getIsActive())
                || student.getRoles().stream()
                .noneMatch(role -> "STUDENT".equalsIgnoreCase(role.getName()))) {
            throw new BadRequestException(
                    "Only active students can be enrolled in a course");
        }

        Course course = getAvailableCourse(courseId);
        return createEnrollment(student, course);
    }

    private CourseEnrollment createEnrollment(User user, Course course) {
        if (enrollmentRepository.existsByUser_IdAndCourse_Id(
                user.getId(), course.getId())) {
            throw new BadRequestException(
                    "Student is already enrolled in this course");
        }

        CourseEnrollment enrollment = CourseEnrollment.builder()
                .user(user)
                .course(course)
                .build();

        CourseEnrollment saved = enrollmentRepository.save(enrollment);
        notificationService.createOnce(
                user.getId(),
                "enrollment:" + saved.getId(),
                "Enrollment confirmed",
                "You were enrolled in " + course.getName() + ".",
                "/courses/" + course.getId()
        );
        return saved;
    }

    @Transactional(readOnly = true)
    public List<CourseEnrollment> getMyCourses(Long userId) {
        return enrollmentRepository
                .findAllByUser_IdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public List<CourseEnrollment> getStudentCourses(Long studentId) {
        User student = userRepository.findById(studentId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Student not found"));
        if (!Boolean.TRUE.equals(student.getIsActive())
                || student.getRoles().stream()
                .noneMatch(role -> "STUDENT".equalsIgnoreCase(role.getName()))) {
            throw new BadRequestException("User is not an active student");
        }

        return getMyCourses(studentId);
    }

    @Transactional
    public void cancelEnrollment(Long userId, Long enrollmentId) {
        CourseEnrollment enrollment = enrollmentRepository
                .findByIdAndUser_Id(enrollmentId, userId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Enrollment not found"));

        long totalLessons = lessonRepository
                .findByCourseIdOrdered(enrollment.getCourse().getId())
                .size();
        long completedLessons = progressRepository
                .findAllByEnrollment_Id(enrollmentId)
                .stream()
                .filter(progress -> progress.isCompleted())
                .count();
        if (totalLessons > 0 && completedLessons * 100 > totalLessons * 20) {
            throw new BadRequestException(
                    "Enrollment cannot be cancelled after completing more than 20% of the course"
            );
        }

        enrollmentRepository.delete(enrollment);
    }

    @Transactional(readOnly = true)
    public DepartmentEnrollmentPreviewDTO previewDepartmentEnrollment(
            Long departmentId,
            Long courseId
    ) {
        return previewDepartmentEnrollment(departmentId, courseId, null);
    }

    @Transactional(readOnly = true)
    public DepartmentEnrollmentPreviewDTO previewDepartmentEnrollment(
            Long departmentId,
            Long courseId,
            Collection<Long> excludedStudentIds
    ) {
        Department department = getDepartment(departmentId);
        Course course = getAvailableCourse(courseId);
        Set<Long> excluded = excludedStudentIds == null
                ? Set.of()
                : new HashSet<>(excludedStudentIds);
        List<User> activeStudents = userRepository
                .findActiveStudentsByDepartmentId(department.getId())
                .stream()
                .filter(student -> !excluded.contains(student.getId()))
                .toList();
        Set<Long> enrolledUserIds = new HashSet<>(
                enrollmentRepository.findEnrolledUserIdsByDepartmentAndCourse(
                        department.getId(), course.getId()));
        long students = activeStudents.size();
        long alreadyEnrolled = activeStudents.stream()
                .filter(student -> enrolledUserIds.contains(student.getId()))
                .count();

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
        return enrollDepartment(departmentId, courseId, null);
    }

    @Transactional
    public DepartmentEnrollmentResultDTO enrollDepartment(
            Long departmentId,
            Long courseId,
            Collection<Long> excludedStudentIds
    ) {
        Department department = getDepartment(departmentId);
        Course course = getAvailableCourse(courseId);
        Set<Long> excluded = excludedStudentIds == null
                ? Set.of()
                : new HashSet<>(excludedStudentIds);
        List<User> students = userRepository
                .findActiveStudentsByDepartmentId(department.getId())
                .stream()
                .filter(student -> !excluded.contains(student.getId()))
                .toList();
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
        List<CourseEnrollment> savedEnrollments = enrollmentRepository.saveAll(newEnrollments);
        for (CourseEnrollment enrollment : savedEnrollments) {
            notificationService.createOnce(
                    enrollment.getUser().getId(),
                    "enrollment:" + enrollment.getId(),
                    "Enrollment confirmed",
                    "You were enrolled in " + course.getName() + ".",
                    "/courses/" + course.getId()
            );
        }

        return new DepartmentEnrollmentResultDTO(
                department.getId(),
                course.getId(),
                course.getName(),
                students.size(),
                students.size() - newEnrollments.size(),
                newEnrollments.size()
        );
    }

    @Transactional(readOnly = true)
    public DepartmentBatchEnrollmentResultDTO previewDepartmentsEnrollment(
            Long courseId,
            List<DepartmentSelection> selections
    ) {
        return processDepartments(courseId, selections, false);
    }

    @Transactional
    public DepartmentBatchEnrollmentResultDTO enrollDepartments(
            Long courseId,
            List<DepartmentSelection> selections
    ) {
        return processDepartments(courseId, selections, true);
    }

    private DepartmentBatchEnrollmentResultDTO processDepartments(
            Long courseId,
            List<DepartmentSelection> selections,
            boolean commit
    ) {
        Course course = getAvailableCourse(courseId);

        Map<Long, Set<Long>> excludedByDepartment = new LinkedHashMap<>();
        for (DepartmentSelection selection : selections) {
            Set<Long> excluded = excludedByDepartment.computeIfAbsent(
                    selection.departmentId(), id -> new HashSet<>());
            if (selection.excludedStudentIds() != null) {
                excluded.addAll(selection.excludedStudentIds());
            }
        }

        Set<Long> enrolledUserIds = new HashSet<>();
        for (CourseEnrollment existing : enrollmentRepository.findAllByCourse_Id(course.getId())) {
            enrolledUserIds.add(existing.getUser().getId());
        }

        List<CourseEnrollment> newEnrollments = new ArrayList<>();
        List<DepartmentBatchItemResultDTO> items = new ArrayList<>();
        long totalAlreadyEnrolled = 0;

        for (Map.Entry<Long, Set<Long>> entry : excludedByDepartment.entrySet()) {
            Department department = getDepartment(entry.getKey());
            Set<Long> excluded = entry.getValue();
            List<User> students = userRepository
                    .findActiveStudentsByDepartmentId(department.getId());

            List<DepartmentMemberDTO> newMembers = new ArrayList<>();
            List<DepartmentMemberDTO> alreadyMembers = new ArrayList<>();
            List<DepartmentMemberDTO> excludedMembers = new ArrayList<>();

            for (User student : students) {
                DepartmentMemberDTO member = new DepartmentMemberDTO(
                        student.getId(),
                        student.getEmail(),
                        student.getFirstName(),
                        student.getLastName(),
                        department.getId(),
                        department.getName());
                if (enrolledUserIds.contains(student.getId())) {
                    alreadyMembers.add(member);
                } else if (excluded.contains(student.getId())) {
                    excludedMembers.add(member);
                } else {
                    enrolledUserIds.add(student.getId());
                    newMembers.add(member);
                    CourseEnrollment enrollment = new CourseEnrollment();
                    enrollment.setUser(student);
                    enrollment.setCourse(course);
                    newEnrollments.add(enrollment);
                }
            }

            totalAlreadyEnrolled += alreadyMembers.size();
            items.add(new DepartmentBatchItemResultDTO(
                    department.getId(),
                    department.getName(),
                    students.size(),
                    alreadyMembers.size(),
                    newMembers.size(),
                    excludedMembers.size(),
                    newMembers,
                    alreadyMembers,
                    excludedMembers
            ));
        }

        if (commit && !newEnrollments.isEmpty()) {
            List<CourseEnrollment> saved = enrollmentRepository.saveAll(newEnrollments);
            for (CourseEnrollment enrollment : saved) {
                notificationService.createOnce(
                        enrollment.getUser().getId(),
                        "enrollment:" + enrollment.getId(),
                        "Enrollment confirmed",
                        "You were enrolled in " + course.getName() + ".",
                        "/courses/" + course.getId()
                );
            }
        }

        return new DepartmentBatchEnrollmentResultDTO(
                course.getId(),
                course.getName(),
                newEnrollments.size(),
                totalAlreadyEnrolled,
                items
        );
    }

    @Transactional(readOnly = true)
    public List<Long> getFullyEnrolledDepartmentIds(Long courseId) {
        getAvailableCourse(courseId);
        Map<Long, Long> enrolled = new java.util.HashMap<>();
        for (Object[] row : enrollmentRepository.countEnrolledStudentsPerDepartmentForCourse(courseId)) {
            enrolled.put((Long) row[0], (Long) row[1]);
        }
        List<Long> result = new ArrayList<>();
        for (Object[] row : userRepository.countActiveStudentsPerDepartment()) {
            Long departmentId = (Long) row[0];
            long total = (Long) row[1];
            if (total > 0 && enrolled.getOrDefault(departmentId, 0L) >= total) {
                result.add(departmentId);
            }
        }
        return result;
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
