package com.example.starter_project_2025.init;

import com.example.starter_project_2025.config.startup.StartupMutation;

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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Seed phòng ban mẫu + gán học viên vào các phòng ban.
 *
 * <p>Hành vi:
 * <ul>
 *   <li><b>Giữ nguyên</b> toàn bộ các phòng ban đã tồn tại trong hệ thống.</li>
 *   <li><b>Bổ sung</b> các phòng ban mẫu còn thiếu (kiểm tra theo {@code code}
 *       trước khi thêm, nên chạy lại nhiều lần không tạo trùng).</li>
 *   <li>Gán học viên vào phòng ban theo tỷ lệ phân bổ <b>không đồng đều</b>
 *       (dùng {@link Random} với fixed seed) để biểu đồ thống kê nhân sự / sinh viên
 *       theo từng phòng ban có sự chênh lệch thực tế.</li>
 * </ul>
 *
 * <p>Phòng ban của học viên đã được gán thì <b>không bị gán lại</b> (idempotent):
 * initializer chỉ gán cho học viên chưa có phòng ban nào.
 */
@Slf4j
@Component
@Order(20)
@RequiredArgsConstructor
@StartupMutation
public class DepartmentStudentDataInitializer
        implements CommandLineRunner {

    private static final String DEPARTMENT_CODE = "FPT";
    private static final String COURSE_NAME = "Java Spring Boot";
    private static final String STUDENT_PASSWORD = "Student123!";

    /** Tổng số học viên mẫu (01..100). */
    private static final int STUDENT_TOTAL = 100;

    /**
     * Tỉ trọng số học viên của từng phòng ban (không đồng đều, cố tình).
     *
     * <p>Tổng = 100. Giá trị càng lệch nhau thì biểu đồ "nhân sự theo phòng ban"
     * càng trông giống dữ liệu thật (không phải chia đều).
     */
    private static final Map<String, Integer> DEPARTMENT_WEIGHTS = new LinkedHashMap<>();

    static {
        // 4 phòng ban mới được bổ sung theo yêu cầu.
        DEPARTMENT_WEIGHTS.put("ENG", 6);    // Engineering
        DEPARTMENT_WEIGHTS.put("DEV", 14);   // Development
        DEPARTMENT_WEIGHTS.put("OPS", 9);    // Operations
        DEPARTMENT_WEIGHTS.put("MKT", 11);   // Marketing
        // Phòng ban có sẵn từ trước (được tạo ở các initializer khác).
        DEPARTMENT_WEIGHTS.put("FPT", 24);
        DEPARTMENT_WEIGHTS.put("IT", 16);
        DEPARTMENT_WEIGHTS.put("HR", 8);
        DEPARTMENT_WEIGHTS.put("SALES", 7);
        DEPARTMENT_WEIGHTS.put("QA", 5);
    }

    /**
     * Mô tả phòng ban mẫu (code -> tên hiển thị). Phòng ban có sẵn vẫn được giữ
     * nguyên tên gốc trong hệ thống; bảng này chỉ dùng khi phòng ban chưa tồn tại.
     */
    private static final Map<String, String> DEPARTMENT_NAMES = new LinkedHashMap<>();

    static {
        DEPARTMENT_NAMES.put("ENG", "Engineering");
        DEPARTMENT_NAMES.put("DEV", "Development");
        DEPARTMENT_NAMES.put("OPS", "Operations");
        DEPARTMENT_NAMES.put("MKT", "Marketing");
        DEPARTMENT_NAMES.put("FPT", "Phòng Phát triển FPT");
        DEPARTMENT_NAMES.put("IT", "Trung tâm Công nghệ Thông tin");
        DEPARTMENT_NAMES.put("HR", "Nhân sự và Đào tạo");
        DEPARTMENT_NAMES.put("SALES", "Khối Kinh doanh");
        DEPARTMENT_NAMES.put("QA", "Bộ phận Kiểm thử");
    }

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
            {"Ngo", "Thanh Ha"},
            {"Vuong", "Anh Tuan"},
            {"Thanh", "Thi Kim"},
            {"Kieu", "Thanh Ha"},
            {"Ha", "Quoc Bao"},
            {"Dao", "Thi Mai"},
            {"Do", "Ngoc Lan"},
            {"Ho", "Quoc Bao"},
            {"Le", "Huy Thanh"},
            {"Pham", "Thi Lan"},
            {"Vu", "Bao Chau"},
            {"Tran", "Hoang Nam"},
            {"Nguyen", "Thi Trang"},
            {"Lo", "Quoc Bao"},
            {"Tao", "Hoang Nam"},
            {"Mai", "Ngoc Lan"},
            {"Cao", "Anh Tuan"},
            {"Bui", "Bao Chau"},
            {"Dinh", "Thanh Ha"},
            {"Ly", "Thanh Ha"},
            {"Thanh", "Thi Mai"},
            {"Truong", "Quoc Bao"},
            {"Do", "Hoang Nam"},
            {"Ho", "Thanh Ha"},
            {"Le", "Thi Trang"},
            {"Pham", "Bao Chau"},
            {"Vu", "Huy Thanh"},
            {"Tran", "Hoang Nam"},
            {"Nguyen", "Thi Mai"},
            {"Mai", "Quoc Bao"},
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

        List<Department> departments = ensureSampleDepartments();
        assignStudentsToDepartments(departments);

        log.info(
                "Seeded {} test students for Department FPT and distributed learners across {} departments. "
                        + "Login: student01@example.com ... student{}@example.com",
                STUDENT_TOTAL, departments.size(), STUDENT_TOTAL
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

    /**
     * Bảo đảm các phòng ban mẫu tồn tại.
     *
     * <p>Phòng ban đã có sẵn trong hệ thống được giữ nguyên (kể cả tên khác);
     * phòng ban thiếu mới được tạo. Không bao giờ xoá phòng ban.
     */
    private List<Department> ensureSampleDepartments() {
        List<Department> departments = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : DEPARTMENT_WEIGHTS.entrySet()) {
            String code = entry.getKey();
            Department department = departmentRepository.findByCodeIgnoreCase(code).orElse(null);
            if (department == null) {
                department = new Department();
                department.setCode(code);
                department.setName(DEPARTMENT_NAMES.getOrDefault(code, code));
                department.setDescription("Phòng ban mẫu " + code);
                department.setIsActive(true);
                department = departmentRepository.save(department);
            }
            departments.add(department);
        }
        return departments;
    }

    /**
     * Gán học viên vào phòng ban theo tỷ lệ không đồng đều.
     *
     * <p>Học viên đã có phòng ban thì <b>không bị gán lại</b> (giữ dữ liệu đã có).
     * Phần còn lại được chia theo trọng số của từng phòng ban; học viên không
     * xếp được vào phòng ban nào sẽ để trống (tạo nhóm "Chưa phân phòng ban"
     * trong báo cáo).
     *
     * <p>Phạm vi: nhóm {@code student01..student100} (seed ở đây) và nhóm
     * {@code student001..student180} (seed ở {@link BulkStudentDataInitializer}).
     */
    private void assignStudentsToDepartments(List<Department> departments) {
        if (departments.isEmpty()) {
            return;
        }

        // Chỉ xét học viên chưa có phòng ban.
        List<User> students = new ArrayList<>();
        for (int i = 1; i <= STUDENT_TOTAL; i++) {
            userRepository.findByEmail(String.format("student%02d@example.com", i))
                    .ifPresent(students::add);
        }
        for (int i = 1; i <= BulkStudentDataInitializer.DEFAULT_STUDENT_TOTAL; i++) {
            userRepository.findByEmail(String.format("student%03d@example.com", i))
                    .ifPresent(students::add);
        }
        if (students.isEmpty()) {
            return;
        }

        // Sắp xếp theo email để thứ tự gán ổn định giữa các lần chạy.
        students.sort((a, b) -> {
            String an = a.getEmail() == null ? "" : a.getEmail();
            String bn = b.getEmail() == null ? "" : b.getEmail();
            return an.compareToIgnoreCase(bn);
        });

        Random random = SeededRandom.forScope("department-assignment");

        // Chuẩn bị "số ghế" cho từng phòng ban theo trọng số -> chia theo kiểu
        // "rải đều có kiểm soát" để mỗi phòng ban có số lượng khác nhau rõ rệt.
        List<Integer> seatPool = buildSeatPool(random, students.size(), departments);

        int seatIndex = 0;
        for (User student : students) {
            if (student.getDepartments() != null && !student.getDepartments().isEmpty()) {
                continue;
            }
            if (seatIndex >= seatPool.size()) {
                // Hết "ghế" -> học viên này để trống phòng ban.
                break;
            }
            Department target = departments.get(seatPool.get(seatIndex++));
            student.getDepartments().add(target);
            userRepository.save(student);
        }
    }

    /**
     * Dựng danh sách chỉ số phòng ban theo trọng số.
     *
     * <p>Mỗi phòng ban nhận số ghế tỉ lệ với trọng số của nó (làm tròn, phần dư
     * phân bổ cho các phòng ban còn thiếu nhiều nhất). Sau đó thứ tự các ghế
     * được xáo trộn bằng {@link Random} có seed cố định để học viên không bị
     * "dồn" vào một phòng ban.
     *
     * @param studentCount số học viên cần gán
     * @param departments  danh sách phòng ban (thứ tự khớp {@link #DEPARTMENT_WEIGHTS})
     */
    private List<Integer> buildSeatPool(Random random, int studentCount, List<Department> departments) {
        int totalWeight = 0;
        for (int weight : DEPARTMENT_WEIGHTS.values()) {
            totalWeight += weight;
        }

        // Số ghế của từng phòng ban = làm tròn(studentCount * trọng số / tổng trọng số).
        int[] seats = new int[departments.size()];
        int assigned = 0;
        for (int i = 0; i < departments.size(); i++) {
            int weight = DEPARTMENT_WEIGHTS.getOrDefault(departments.get(i).getCode(), 1);
            seats[i] = (int) Math.floor(studentCount * (double) weight / totalWeight);
            assigned += seats[i];
        }

        // Phần dư: chia cho phòng ban còn thiếu nhiều nhất (giữ tổng = studentCount).
        int remaining = studentCount - assigned;
        while (remaining > 0) {
            int best = -1;
            for (int i = 0; i < seats.length; i++) {
                int weight = DEPARTMENT_WEIGHTS.getOrDefault(departments.get(i).getCode(), 1);
                if (best < 0 || weight > DEPARTMENT_WEIGHTS.getOrDefault(departments.get(best).getCode(), 1)) {
                    best = i;
                }
            }
            if (best < 0) {
                break;
            }
            seats[best]++;
            remaining--;
        }

        List<Integer> pool = new ArrayList<>(studentCount);
        for (int i = 0; i < seats.length; i++) {
            for (int k = 0; k < seats[i]; k++) {
                pool.add(i);
            }
        }
        // Xáo trộn để học viên không bị dồn vào các phòng ban đầu tiên.
        return SeededRandom.shuffled(pool, random);
    }

    private Course ensureCourse() {
        var existing = courseRepository.findByName(COURSE_NAME);
        if (existing.isPresent()) return existing.get();
        Course course = new Course();

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
