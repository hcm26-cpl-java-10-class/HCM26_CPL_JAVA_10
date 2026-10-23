package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

/**
 * Quản lý tài khoản "khách" cho học sinh thi bằng link anonymous
 * (không có tài khoản RBAC).
 * <p>
 * Vì {@code ExamAttempt.student} là bắt buộc và trỏ tới {@code User}, mỗi học
 * sinh anonymous cần một user để gắn bài thi. User này được đánh dấu
 * {@code isGuest = true}, bị khoá (không đăng nhập được) và chỉ dùng để lưu
 * kết quả bài thi + gửi email.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GuestUserService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Tìm hoặc tạo user khách cho học sinh.
     * <p>
     * Idempotent theo email: nếu email đó đã có user khách thì dùng lại user đó,
     * không tạo trùng.
     * <p>
     * <b>Không bao giờ</b> gắn bài thi vào một tài khoản RBAC thật. Endpoint tạo
     * phiên là public, chỉ cần nhập email của đồng nghiệp là bài thi sẽ bị ghi
     * vào tài khoản của họ. Nếu email trùng tài khoản thật thì tạo một user khách
     * riêng với email nội bộ; email học sinh nhập vẫn được giữ ở
     * {@code Invitation}/{@code AnonymousSession} để gửi kết quả.
     *
     * @param fullName tên học sinh nhập, dùng làm firstName/lastName
     */
    @Transactional
    public User findOrCreateGuest(String email, String fullName) {
        String normalizedEmail = email.trim().toLowerCase();

        Optional<User> existing = userRepository.findByEmail(normalizedEmail);
        if (existing.isPresent() && Boolean.TRUE.equals(existing.get().getIsGuest())) {
            return existing.get();
        }

        Role studentRole = roleRepository.findByName("STUDENT")
                .orElseThrow(() -> new IllegalStateException("Role STUDENT not found"));

        // Email đã bị tài khoản thật chiếm -> user khách dùng email nội bộ riêng.
        boolean emailTaken = existing.isPresent();
        String storedEmail = emailTaken ? buildInternalGuestEmail(normalizedEmail) : normalizedEmail;

        User guest = User.builder()
                .email(storedEmail)
                .username(generateUsername(storedEmail))
                .passwordHash(passwordEncoder.encode(generateRandomPassword()))
                .firstName(toFirstName(fullName))
                .lastName(toLastName(fullName))
                .description(emailTaken
                        ? "Guest account for anonymous exam access (email taken by a real account)"
                        : "Guest account created from anonymous exam access link")
                .isActive(true)
                .locked(true)
                .isGuest(true)
                .build();
        guest.getRoles().add(studentRole);

        User saved = userRepository.save(guest);
        log.info("Created guest user id={} email={} (emailTakenByRealAccount={})",
                saved.getId(), storedEmail, emailTaken);
        return saved;
    }

    /**
     * Sinh email nội bộ cho user khách khi email học sinh nhập đã thuộc về một
     * tài khoản RBAC thật. Dùng miền {@code .invalid} (RFC 2606) vì địa chỉ này
     * không bao giờ được gửi email.
     */
    private String buildInternalGuestEmail(String takenEmail) {
        String prefix = "guest-" + Integer.toHexString(takenEmail.hashCode());
        String candidate = prefix + "@anon.invalid";
        String unique = candidate;
        int suffix = 1;
        while (userRepository.existsByEmail(unique)) {
            unique = prefix + "-" + suffix + "@anon.invalid";
            suffix++;
        }
        return unique;
    }

    private String generateUsername(String email) {
        // Tối đa 50 ký tự theo ràng buộc của cột username.
        String base = "guest_" + Integer.toHexString(email.hashCode());
        if (base.length() > 50) {
            base = base.substring(0, 50);
        }
        return base;
    }

    private String generateRandomPassword() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** "Nguyen Van A" -> firstName "Nguyen", lastName "Van A". */
    private String toFirstName(String fullName) {
        String trimmed = fullName == null ? "" : fullName.trim();
        if (trimmed.isEmpty()) {
            return "Guest";
        }
        int space = trimmed.indexOf(' ');
        return space > 0 ? trimmed.substring(0, space) : trimmed;
    }

    private String toLastName(String fullName) {
        String trimmed = fullName == null ? "" : fullName.trim();
        int space = trimmed.indexOf(' ');
        return space > 0 ? trimmed.substring(space + 1) : null;
    }
}
