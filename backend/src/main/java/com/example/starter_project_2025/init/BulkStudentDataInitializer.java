package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
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

import java.util.List;

/**
 * Seed nhiều tài khoản role STUDENT để test luồng invitation hàng loạt.
 * <p>
 * Cố ý KHÔNG tạo invitation ở đây - mục tiêu là test việc tạo lời mời
 * thông qua UI/API thật, nên chỉ cần đủ user để chọn.
 * <p>
 * Idempotent: nếu email đã tồn tại thì bỏ qua, không ghi đè mật khẩu/role.
 * Nhờ vậy restart backend không làm hỏng dữ liệu đã tạo.
 */
@Slf4j
@Order(4)
@Component
@RequiredArgsConstructor
public class BulkStudentDataInitializer implements CommandLineRunner {

    /** Họ và tên Việt dùng để sinh dữ liệu cho dễ đọc. */
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
            new String[]{"Ly", "Thi Thao"
    });

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.bulk-students.count:30}")
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

        int created = 0;
        int skipped = 0;

        for (int i = 1; i <= count; i++) {
            String email = buildEmail(i);

            if (userRepository.existsByEmail(email)) {
                skipped++;
                continue;
            }

            String[] name = pickName(i);
            User user = User.builder()
                    .email(email)
                    .passwordHash(passwordEncoder.encode(rawPassword))
                    .firstName(name[0])
                    .lastName(name[1])
                    .isActive(true)
                    .locked(false)
                    .build();
            user.getRoles().add(studentRole);

            userRepository.save(user);
            created++;
        }

        log.info("Seeded bulk students: created={}, skipped={}, total={}.", created, skipped, count);
    }

    private String buildEmail(int index) {
        return "student" + index + "@example.com";
    }

    /**
     * Lấy tên theo vòng tròn danh sách để số lượng seed không bị giới hạn
     * bởi độ dài danh sách tên có sẵn.
     */
    private String[] pickName(int index) {
        return STUDENT_NAMES.get((index - 1) % STUDENT_NAMES.size());
    }
}
