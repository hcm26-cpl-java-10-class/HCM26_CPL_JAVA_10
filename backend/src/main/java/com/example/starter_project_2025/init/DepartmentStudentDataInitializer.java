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

import java.util.List;

@Slf4j
@Component
@Order(20)
@RequiredArgsConstructor
public class DepartmentStudentDataInitializer
        implements CommandLineRunner {

    private static final String DEPARTMENT_CODE = "FPT";
    private static final String COURSE_NAME = "Java Spring Boot";
    private static final String STUDENT_PASSWORD = "Student123!";

    /** Tổng số học viên mẫu (01..100). */
    private static final int STUDENT_TOTAL = 100;

    /**
     * Tên học viên mẫu. Dùng để bảng "Study time per learner" / "At risk" trông
     * giống dữ liệu thật thay vì "Student01 FPT".
     */
    private static final String[][] STUDENT_NAMES = {
            {"Nguyen", "Van An"},
            {"Tran", "Thi Binh"},
            {"Le", "Minh Chau"},
            {"Pham", "Gia Duy"},
            {"Do", "Ha Em"},
            {"Hoang", "Thi Lan"},
            {"Vu", "Quoc Bao"},
            {"Dang", "Thi Mai"},
            {"Bui", "Anh Tuan"},
            {"Ngo", "Thi Lan"},
            {"Duong", "Van Hieu"},
            {"Ly", "Thanh Son"},
            {"Truong", "Thi Ngoc"},
            {"Cao", "Minh Duc"},
            {"Mai", "Thi Huong"},
            {"Dao", "Van Nam"},
            {"Tao", "Thi Kim"},
            {"Ha", "Duc Phuong"},
            {"Vuong", "Thi Lan"},
            {"Thanh", "Ngoc Diep"},
            {"Kieu", "Thi Mai"},
            {"Dinh", "Quoc Khanh"},
            {"Vu", "Thanh Tung"},
            {"Trinh", "Thi Ha"},
            {"Nguyen", "Tuan Kiyet"},
            {"Pham", "Thi Trang"},
            {"Ho", "Van Thanh"},
            {"Lo", "Thi Ngoc"},
            {"Ly", "Thi Thao"},
            {"Dang", "Hoai Thuong"},
            {"Nguyen", "Thanh Tung"},
            {"Tran", "Quoc Bao"},
            {"Le", "Thanh Ha"},
            {"Pham", "Ngoc Lan"},
            {"Hoang", "Minh Duc"},
            {"Vu", "Thi Mai"},
            {"Do", "Quang Huy"},
            {"Bui", "Hoang Nam"},
            {"Nguyen", "Huy Thanh"},
            {"Tran", "Thi Kim"},
            {"Le", "Anh Khoa"},
            {"Pham", "Bao Chau"},
            {"Ho", "Thanh Tung"},
            {"Dang", "Minh Quan"},
            {"Ly", "Thi Trang"},
            {"Truong", "Hoang Nam"},
            {"Mai", "Quoc Bao"},
            {"Vu", "Ngoc Lan"},
            {"Cao", "Minh Hieu"},
            {"Ngo", "Bao Chau"},
            {"Dinh", "Thanh Ha"},
            {"Tao", "Hoang Nam"},
            {"Ha", "Ngoc Lan"},
            {"Kieu", "Minh Duc"},
            {"Thanh", "Thi Trang"},
            {"Dao", "Anh Tuan"},
            {"Do", "Thanh Ha"},
            {"Ho", "Quoc Bao"},
            {"Le", "Thi Mai"},
            {"Pham", "Minh Quan"},
            {"Vu", "Huy Thanh"},
            {"Tran", "Thi Lan"},
            {"Nguyen", "Anh Khoa"},
            {"Bui", "Thi Trang"},
            {"Ly", "Quoc Bao"},
            {"Mai", "Hoang Nam"},
            {"Dang", "Ngoc Lan"},
            {"Truong", "Minh Hieu"},
            {"Hoang", "Bao Chau"},
            {"Cao", "Thanh Ha"},
            {"Dinh", "Quoc Bao"},
            {"Ngo", "Minh Duc"},
            {"Vuong", "Anh Tuan"},
            {"Thanh", "Thi Kim"},
            {"Kieu", "Hoang Nam"},
            {"Ha", "Quoc Bao"},
            {"Dao", "Thi Mai"},
            {"Do", "Ngoc Lan"},
            {"Ho", "Minh Quan"},
            {"Le", "Huy Thanh"},
            {"Pham", "Thi Lan"},
            {"Vu", "Bao Chau"},
            {"Tran", "Minh Duc"},
            {"Nguyen", "Thi Trang"},
            {"Lo", "Quoc Bao"},
            {"Tao", "Hoang Nam"},
            {"Mai", "Ngoc Lan"},
            {"Cao", "Anh Tuan"},
            {"Bui", "Thanh Ha"},
            {"Dinh", "Minh Quan"},
            {"Ly", "Hoang Nam"},
            {"Thanh", "Thi Mai"},
            {"Truong", "Quoc Bao"},
            {"Do", "Hoang Nam"},
            {"Ho", "Thi Trang"},
            {"Le", "Anh Tuan"},
            {"Pham", "Bao Chau"},
            {"Vu", "Minh Quan"},
            {"Tran", "Hoang Nam"},
            {"Nguyen", "Thi Mai"},
            {"Mai", "Minh Duc"},
            {"Dang", "Thi Trang"},
            {"Kieu", "Quoc Bao"},
            {"Hoang", "Thi Mai"},
            {"Xa", "Thi Lan"},
            {"Tong", "Anh Tuan"},
            {"Vu", "Thanh Ha"},
            {"Ly", "Quoc Bao"}
    };

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

        for (int i = 1; i <= STUDENT_TOTAL; i++) {
            ensureStudent(i, department, studentRole);
        }

        log.info(
                "Seeded {} test students for Department FPT. " +
                        "Login: student01@example.com ... student{}@example.com",
                STUDENT_TOTAL, STUDENT_TOTAL
        );
    }

    private Department ensureDepartment() {
        Department department = departmentRepository
                .findByCodeIgnoreCase(DEPARTMENT_CODE)
                .orElseGet(Department::new);

        department.setName("FPT");
        department.setCode(DEPARTMENT_CODE);
        department.setDescription(
                "Department chứa " + STUDENT_TOTAL + " sinh viên dùng để test enrollment");
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
                    return newUser;
                });

        // Gán lại tên mỗi lần seed để dữ liệu cũ cũng được cập nhật.
        String[] name = STUDENT_NAMES[(number - 1) % STUDENT_NAMES.length];
        user.setFirstName(name[0]);
        user.setLastName(name[1]);
        user.setDescription("Học viên mẫu " + String.format("%02d", number));
        user.setIsActive(true);
        user.getDepartments().add(department);
        user.getRoles().add(studentRole);

        userRepository.save(user);
    }
}
