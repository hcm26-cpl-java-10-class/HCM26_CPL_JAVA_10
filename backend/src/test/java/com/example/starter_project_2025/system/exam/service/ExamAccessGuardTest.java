package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
class ExamAccessGuardTest {

    private static final Long OWNER_ID = 10L;
    private static final Long OTHER_TEACHER_ID = 20L;

    private ExamAccessGuard guard;

    @BeforeEach
    void setUp() {
        guard = new ExamAccessGuard();
    }

    private Exam examOwnedBy(Long userId) {
        Exam exam = new Exam();
        exam.setId(1L);
        exam.setTitle("Kỳ thi");
        exam.setCreatedBy(userId);
        return exam;
    }

    private UserPrincipal principal(Long userId, String... roleNames) {
        User user = User.builder()
                .id(userId)
                .email("u" + userId + "@example.com")
                .firstName("User")
                .passwordHash("x")
                .isActive(true)
                .isGuest(false)
                .locked(false)
                .build();

        Set<Role> roles = new java.util.HashSet<>();
        for (String roleName : roleNames) {
            roles.add(Role.builder().name(roleName).build());
        }
        user.setRoles(roles);

        return new UserPrincipal(user, List.of(new SimpleGrantedAuthority("ROLE_" + roleNames[0])));
    }

    @Test
    @DisplayName("Giáo viên tạo đề thi được phép quản lý lời mời của đề đó")
    void ownerCanManage() {
        Exam exam = examOwnedBy(OWNER_ID);
        UserPrincipal principal = principal(OWNER_ID, "TEACHER");

        assertTrue(guard.canManage(exam, principal));
        assertDoesNotThrow(() -> guard.checkCanManage(exam, principal));
    }

    @Test
    @DisplayName("Giáo viên khác bị chặn xem lời mời của đề người khác")
    void otherTeacherBlocked() {
        Exam exam = examOwnedBy(OWNER_ID);
        UserPrincipal principal = principal(OTHER_TEACHER_ID, "TEACHER");

        assertFalse(guard.canManage(exam, principal));
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> guard.checkCanManage(exam, principal));
        assertTrue(ex.getMessage().contains("không có quyền"));
    }

    @Test
    @DisplayName("ADMIN luôn được phép quản lý mọi đề thi")
    void adminAlwaysAllowed() {
        Exam exam = examOwnedBy(OWNER_ID);
        UserPrincipal principal = principal(OTHER_TEACHER_ID, "ADMIN");

        assertTrue(guard.canManage(exam, principal));
        assertTrue(guard.isAdmin(principal));
    }

    @Test
    @DisplayName("Sinh viên không được quản lý lời mời")
    void studentBlocked() {
        Exam exam = examOwnedBy(OWNER_ID);
        UserPrincipal principal = principal(OWNER_ID, "STUDENT");

        assertFalse(guard.canManage(exam, principal));
        assertFalse(guard.isAdmin(principal));
    }

    @Test
    @DisplayName("Đề thi không có createdBy thì không ai ngoài ADMIN quản lý được")
    void examWithoutOwnerIsAdminOnly() {
        Exam exam = examOwnedBy(null);
        UserPrincipal principal = principal(OWNER_ID, "TEACHER");

        assertFalse(guard.canManage(exam, principal));
        assertTrue(guard.canManage(exam, principal(OWNER_ID, "ADMIN")));
    }
}
