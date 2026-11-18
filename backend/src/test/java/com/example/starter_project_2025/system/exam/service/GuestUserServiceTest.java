package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GuestUserServiceTest {

    private static final String EMAIL = "student@example.com";
    private static final String FULL_NAME = "Nguyen Van A";

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private GuestUserService service;

    @BeforeEach
    void setUp() {
        service = new GuestUserService(userRepository, roleRepository, passwordEncoder);
    }

    @Test
    @DisplayName("Email thuộc tài khoản thật thì tạo user khách với email nội bộ @anon.invalid")
    void realAccountEmailCreatesIsolatedGuestAccount() {
        User realUser = User.builder()
                .id(42L)
                .email(EMAIL)
                .isGuest(false)
                .isActive(true)
                .build();

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(realUser));
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(roleRepository.findByName("STUDENT"))
                .thenReturn(Optional.of(Role.builder().name("STUDENT").build()));
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(500L);
            return u;
        });

        User result = service.findOrCreateGuest(EMAIL, FULL_NAME);

        assertNotEquals(42L, result.getId(), "không được dùng lại user thật");
        assertTrue(Boolean.TRUE.equals(result.getIsGuest()));
        assertTrue(result.getEmail().endsWith("@anon.invalid"),
                "email nội bộ phải dùng miền .invalid, thực tế: " + result.getEmail());
        assertNotEquals(EMAIL, result.getEmail());
        assertTrue(result.getLocked(), "user khách phải bị khoá");
        assertEquals("Nguyen", result.getFirstName());
        assertEquals("Van A", result.getLastName());
    }

    @Test
    @DisplayName("Email đã có user khách thì tái dùng, không tạo trùng")
    void existingGuestIsReused() {
        User existing = User.builder().id(88L).email(EMAIL).isGuest(true).build();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(existing));

        User result = service.findOrCreateGuest(EMAIL, FULL_NAME);

        assertEquals(88L, result.getId());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    @DisplayName("Email trống thì vẫn tạo được user khách để thi ẩn danh")
    void blankEmailStillCreatesAnonymousAccount() {
        when(roleRepository.findByName("STUDENT"))
                .thenReturn(Optional.of(Role.builder().name("STUDENT").build()));
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(501L);
            return u;
        });

        User result = service.findOrCreateGuest("", "Khách");

        assertNotNull(result.getId());
        assertTrue(Boolean.TRUE.equals(result.getIsGuest()));
        assertTrue(result.getEmail().endsWith("@anon.invalid"),
                "email nội bộ phải dùng miền .invalid, thực tế: " + result.getEmail());
        assertEquals("Khách", result.getFirstName());
    }

    @Test
    @DisplayName("Email nội bộ @anon.invalid đã tồn tại thì sinh tiếp hậu tố để không trùng")
    void internalEmailCollisionGetsSuffix() {
        User realUser = User.builder().id(42L).email(EMAIL).isGuest(false).build();
        String base = "guest-" + Integer.toHexString(EMAIL.hashCode()) + "@anon.invalid";

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(realUser));
        when(userRepository.existsByEmail(base)).thenReturn(true);
        when(userRepository.existsByEmail("guest-" + Integer.toHexString(EMAIL.hashCode()) + "-1@anon.invalid"))
                .thenReturn(false);
        when(roleRepository.findByName("STUDENT"))
                .thenReturn(Optional.of(Role.builder().name("STUDENT").build()));
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(502L);
            return u;
        });

        User result = service.findOrCreateGuest(EMAIL, FULL_NAME);

        assertTrue(result.getEmail().endsWith("-1@anon.invalid"), "thực tế: " + result.getEmail());
        assertFalse(result.getEmail().equals(base));
    }
}
