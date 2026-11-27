package com.example.starter_project_2025.init;

import com.example.starter_project_2025.config.startup.StartupMutation;

import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.StudentUserCodeGenerator;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Seed tập học viên mẫu lớn (mặc định 180 tài khoản) dùng làm "pool" cho các
 * initializer khác (Course Analytics, Exam Data) và để test các bộ lọc danh sách.
 *
 * <p>Định danh: {@code student001@example.com} ... {@code student180@example.com}
 * (tiền tố {@code student} + 3 chữ số). Tiền tố này <b>khác</b> nhóm
 * {@code student01@example.com}...{@code student100@example.com} do
 * {@link DepartmentStudentDataInitializer} tạo, nên hai nhóm không trùng email.
 *
 * <p>Nhóm hành vi (tier) được gán <b>ổn định theo seed</b>:
 * <ul>
 *   <li>{@code ACTIVE} — đăng ký 3..5 khóa học (nhóm tích cực).</li>
 *   <li>{@code REGULAR} — đăng ký 1..2 khóa học (nhóm phổ thông).</li>
 *   <li>{@code IDLE} — chưa đăng ký khóa học nào (dùng test bộ lọc danh sách trống).</li>
 * </ul>
 *
 * <p>Tier được lưu vào {@code user.description} dưới dạng nhãn ổn định
 * ({@code SEED_TIER=ACTIVE} ...) để các initializer khác đọc lại được mà không
 * cần thêm cột mới vào schema.
 *
 * <p><b>Idempotent:</b> chỉ tạo tài khoản còn thiếu; tài khoản đã tồn tại thì
 * không bị sửa/xoá. Không bao giờ {@code deleteAll}.
 */
@Slf4j
@Order(19)
@Component
@RequiredArgsConstructor
@StartupMutation
public class BulkStudentDataInitializer implements CommandLineRunner {

    /** Tổng số học viên mẫu mặc định (150..200 theo yêu cầu). */
    public static final int DEFAULT_STUDENT_TOTAL = 180;

    /** Tổng số học viên mẫu trong hệ thống (student001 ... student180). */
    private static final int STUDENT_TOTAL = DEFAULT_STUDENT_TOTAL;

    private static final String EMAIL_TEMPLATE = "student%03d@example.com";

    /** Nhãn tier được ghi vào {@code description} để các initializer khác đọc lại. */
    public static final String TIER_PREFIX = "SEED_TIER=";

    /** Học viên tích cực: đăng ký 3..5 khóa học. */
    public static final String TIER_ACTIVE = "ACTIVE";

    /** Học viên phổ thông: đăng ký 1..2 khóa học. */
    public static final String TIER_REGULAR = "REGULAR";

    /** Học viên chưa kích hoạt: chưa đăng ký khóa học nào. */
    public static final String TIER_IDLE = "IDLE";

    /**
     * Tỉ trọng tier. Tổng = 100.
     * <ul>
     *   <li>30% tích cực (nhiều khóa, giữ chân tốt).</li>
     *   <li>55% phổ thông (1..2 khóa).</li>
     *   <li>15% chưa kích hoạt (0 khóa) để test bộ lọc danh sách trống.</li>
     * </ul>
     */
    private static final int TIER_ACTIVE_WEIGHT = 30;
    private static final int TIER_REGULAR_WEIGHT = 55;
    private static final int TIER_IDLE_WEIGHT = 15;

    private static final List<String[]> STUDENT_NAMES = List.of(
            new String[]{"Nguyen", "Van An"},
            new String[]{"Tran", "Thi Binh"},
            new String[]{"Le", "Minh Chau"},
            new String[]{"Pham", "Gia Duy"},
            new String[]{"Do", "Ha Em"},
            new String[]{"Hoang", "Thi Lan"},
            new String[]{"Vu", "Quoc Bao"},
            new String[]{"Dang", "Thi Mai"},
            new String[]{"Bui", "Anh Tuan"},
            new String[]{"Ngo", "Thi Lan"},
            new String[]{"Duong", "Van Hieu"},
            new String[]{"Ly", "Thanh Son"},
            new String[]{"Truong", "Thi Ngoc"},
            new String[]{"Cao", "Minh Duc"},
            new String[]{"Mai", "Thi Huong"},
            new String[]{"Dao", "Van Nam"},
            new String[]{"Tao", "Thi Kim"},
            new String[]{"Ha", "Duc Phuong"},
            new String[]{"Vuong", "Thi Lan"},
            new String[]{"Thanh", "Ngoc Diep"},
            new String[]{"Kieu", "Thi Mai"},
            new String[]{"Dinh", "Quoc Khanh"},
            new String[]{"Vu", "Thanh Tung"},
            new String[]{"Trinh", "Thi Ha"},
            new String[]{"Nguyen", "Tuan Kiyet"},
            new String[]{"Pham", "Thi Trang"},
            new String[]{"Ho", "Van Thanh"},
            new String[]{"Lo", "Thi Ngoc"},
            new String[]{"Ly", "Thi Thao"}
    );

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final StudentUserCodeGenerator studentUserCodeGenerator;

    @Value("${app.seed.bulk-students.count:" + DEFAULT_STUDENT_TOTAL + "}")
    private int count;

    @Value("${app.seed.bulk-students.password:password123}")
    private String rawPassword;

    @Override
    @Transactional
    public void run(String... args) {
        if (count <= 0) {
            log.info("Bulk student seeding disabled (app.seed.bulk-students.count={}).", count);
            return;
        }

        Role studentRole = roleRepository.findByName("STUDENT")
                .orElseThrow(() -> new IllegalStateException(
                        "Role STUDENT not found. Ensure role seed runs first."));

        Random random = SeededRandom.forScope("bulk-student-tier");

        int created = 0;
        int skipped = 0;

        for (int i = 1; i <= count; i++) {
            String email = String.format(EMAIL_TEMPLATE, i);

            if (userRepository.existsByEmail(email)) {
                skipped++;
                continue;
            }

            String[] name = pickName(i);
            User user = User.builder()
                    .email(email)
                    .username(String.format("student%03d", i))
                    .passwordHash(passwordEncoder.encode(rawPassword))
                    .firstName(name[0])
                    .lastName(name[1])
                    .description(TIER_PREFIX + tierFor(i, random))
                    .isActive(true)
                    .locked(false)
                    .build();
            user.getRoles().add(studentRole);
            studentUserCodeGenerator.assignIfMissing(user);

            userRepository.save(user);
            created++;
        }

        log.info("Seeded bulk students: created={}, skipped={}, total={}. "
                        + "Login: student001@example.com ... student{}@example.com",
                created, skipped, count, String.format("%03d", count));
    }

    /**
     * Xác định tier của học viên thứ {@code index}.
     *
     * <p>Dùng {@link Random} có seed cố định nên phân bổ tier luôn giống nhau
     * giữa các lần chạy. Mỗi tier được gán theo dải liên tiếp để tổng số lượng
     * chính xác theo tỉ trọng thiết kế.
     */
    private static String tierFor(int index, Random random) {
        // Chuẩn hoá chỉ số về [0, 100) rồi chia theo tỉ trọng.
        int bucket = Math.floorMod(random.nextInt(100), 100);
        if (bucket < TIER_ACTIVE_WEIGHT) {
            return TIER_ACTIVE;
        }
        if (bucket < TIER_ACTIVE_WEIGHT + TIER_REGULAR_WEIGHT) {
            return TIER_REGULAR;
        }
        return TIER_IDLE;
    }

    private String[] pickName(int index) {
        return STUDENT_NAMES.get((index - 1) % STUDENT_NAMES.size());
    }

    // =====================================================================
    // Tiện ích đọc lại tier từ các initializer khác
    // =====================================================================

    /**
     * Đọc tier của một học viên từ {@code description}.
     *
     * @return {@code null} nếu học viên không do initializer này tạo
     */
    public static String tierOf(User user) {
        if (user == null) {
            return null;
        }
        String description = user.getDescription();
        if (description == null) {
            return null;
        }
        int index = description.indexOf(TIER_PREFIX);
        if (index < 0) {
            return null;
        }
        String tail = description.substring(index + TIER_PREFIX.length());
        int end = tail.indexOf(';');
        if (end >= 0) {
            tail = tail.substring(0, end);
        }
        end = tail.indexOf(' ');
        if (end >= 0) {
            tail = tail.substring(0, end);
        }
        tail = tail.trim();
        return tail.isEmpty() ? null : tail;
    }

    /**
     * Số khóa học tối thiểu mà một học viên của tier này nên đăng ký.
     * Dùng bởi {@link CourseAnalyticsDataInitializer} để đảm bảo có nhóm học viên
     * chưa đăng ký khóa học nào.
     */
    public static int minCoursesForTier(String tier) {
        if (TIER_ACTIVE.equals(tier)) {
            return 3;
        }
        if (TIER_REGULAR.equals(tier)) {
            return 1;
        }
        if (TIER_IDLE.equals(tier)) {
            return 0;
        }
        return 1;
    }

    /**
     * Số khóa học tối đa mà một học viên của tier này nên đăng ký.
     */
    public static int maxCoursesForTier(String tier) {
        if (TIER_ACTIVE.equals(tier)) {
            return 5;
        }
        if (TIER_REGULAR.equals(tier)) {
            return 2;
        }
        if (TIER_IDLE.equals(tier)) {
            return 0;
        }
        return 2;
    }

    /**
     * Danh sách học viên mẫu do initializer này tạo, sắp xếp theo email.
     */
    public List<User> findSeededStudents() {
        List<User> students = new ArrayList<>();
        for (int i = 1; i <= STUDENT_TOTAL; i++) {
            userRepository.findByEmail(String.format(EMAIL_TEMPLATE, i))
                    .ifPresent(students::add);
        }
        return students;
    }
}
