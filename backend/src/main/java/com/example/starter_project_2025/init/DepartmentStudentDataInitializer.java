package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.department.Department;
import com.example.starter_project_2025.system.demo.department.DepartmentRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@Order(20)
@RequiredArgsConstructor
public class DepartmentStudentDataInitializer
        implements CommandLineRunner {

    private static final String DEPARTMENT_CODE = "FPT";
    private static final String COURSE_NAME = "Java Spring Boot";
    private static final String STUDENT_PASSWORD = "Student123!";

    private final DepartmentRepository departmentRepository;
    private final CourseRepository courseRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        Department department = ensureDepartment();

        Role studentRole = roleRepository.findByName("STUDENT")
                .orElseThrow(() ->
                        new IllegalStateException(
                                "Role STUDENT not found"));

        ensureCourse();

        for (int i = 1; i <= 50; i++) {
            ensureStudent(i, department, studentRole);
        }

        log.info(
                "Seeded 50 test students for Department FPT. " +
                        "Login: student01@example.com ... student50@example.com"
        );
    }

    private Department ensureDepartment() {
        Department department = departmentRepository
                .findByCodeIgnoreCase(DEPARTMENT_CODE)
                .orElseGet(Department::new);

        department.setName("FPT");
        department.setCode(DEPARTMENT_CODE);
        department.setDescription(
                "Department chứa 50 sinh viên dùng để test enrollment");
        department.setIsActive(true);

        return departmentRepository.save(department);
    }

    private Course ensureCourse() {
        Course course = courseRepository.findByName(COURSE_NAME)
                .orElseGet(Course::new);

        course.setName(COURSE_NAME);
        course.setDescription(
                "Khóa học Java và phát triển backend với Spring Boot");
        course.setStatus(CourseStatus.PUBLISHED);
        course.setIsFree(true);
        course.setIsActive(true);

        return courseRepository.save(course);
    }

    private void ensureStudent(
            int number,
            Department department,
            Role studentRole
    ) {
        String email = String.format(
                "student%02d@example.com", number);

        User user = userRepository.findByEmail(email)
                .orElseGet(() -> {
                    User newUser = new User();
                    newUser.setEmail(email);
                    newUser.setPasswordHash(
                            passwordEncoder.encode(STUDENT_PASSWORD));
                    newUser.setFirstName(
                            String.format("Student%02d", number));
                    newUser.setLastName("FPT");
                    return newUser;
                });

        user.setDepartment(department);
        user.setIsActive(true);
        user.getRoles().add(studentRole);

        userRepository.save(user);
    }
}
