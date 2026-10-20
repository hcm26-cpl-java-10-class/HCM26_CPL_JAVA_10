package com.example.starter_project_2025.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.profile.ProfileServiceImpl;
import com.example.starter_project_2025.system.profile.dto.ChangePasswordRequest;
import com.example.starter_project_2025.system.profile.dto.UpdateProfileRequest;
import com.example.starter_project_2025.system.profile.dto.UserProfileResponse;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ProfileServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private ProfileServiceImpl profileService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        Role adminRole = Role.builder().name("ADMIN").build();

        sampleUser = User.builder()
                .id(1L)
                .email("admin@example.com")
                .passwordHash("$2a$10$hashedPasswordSample")
                .firstName("Minh Anh")
                .lastName("Tran")
                .phoneNumber("0903 221 879")
                .employeeCode("EMP10014")
                .department("FHN.G2")
                .isActive(true)
                .roles(Set.of(adminRole))
                .build();
    }

    @Test
    @DisplayName("getProfile - Should return complete profile DTO for active user")
    void getProfile_ShouldReturnProfile() {
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(sampleUser));

        UserProfileResponse response = profileService.getProfile("admin@example.com");

        assertNotNull(response);
        assertEquals("admin@example.com", response.email());
        assertEquals("Minh Anh Tran", response.fullName());
        assertEquals("EMP10014", response.employeeCode());
        assertEquals("0903 221 879", response.phoneNumber());
        assertEquals("ADMIN", response.role());
        assertEquals("FHN.G2", response.department());
        assertEquals("Active", response.status());
        assertNull(response.lastLogin());
        assertNull(response.device());
    }

    @Test
    @DisplayName("getProfile - Should throw ResourceNotFoundException when user does not exist")
    void getProfile_UserNotFound_ShouldThrow() {
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> profileService.getProfile("unknown@example.com"));
    }

    @Test
    @DisplayName("getProfile - Should throw AccessDeniedException when user is inactive")
    void getProfile_InactiveUser_ShouldThrow() {
        sampleUser.setIsActive(false);
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(sampleUser));

        assertThrows(AccessDeniedException.class, () -> profileService.getProfile("admin@example.com"));
    }

    @Test
    @DisplayName("updateProfile - Should update full name and phone number successfully")
    void updateProfile_ShouldUpdateSuccessfully() {
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(sampleUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateProfileRequest request = new UpdateProfileRequest("Jane Doe Smith", "0988 777 666");
        UserProfileResponse response = profileService.updateProfile("admin@example.com", request);

        assertNotNull(response);
        assertEquals("Jane", sampleUser.getFirstName());
        assertEquals("Doe Smith", sampleUser.getLastName());
        assertEquals("0988 777 666", sampleUser.getPhoneNumber());
        // Verify protected fields remained unchanged
        assertEquals("admin@example.com", sampleUser.getEmail());
        assertEquals("EMP10014", sampleUser.getEmployeeCode());
        assertEquals("FHN.G2", sampleUser.getDepartment());
    }

    @Test
    @DisplayName("changePassword - Should succeed when current password is valid")
    void changePassword_ValidCurrentPassword_ShouldSucceed() {
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("oldPass123", sampleUser.getPasswordHash())).thenReturn(true);
        when(passwordEncoder.encode("newPass456")).thenReturn("$2a$10$newHashedPassword");

        ChangePasswordRequest request = new ChangePasswordRequest("oldPass123", "newPass456", "newPass456");
        assertDoesNotThrow(() -> profileService.changePassword("admin@example.com", request));

        assertEquals("$2a$10$newHashedPassword", sampleUser.getPasswordHash());
        verify(userRepository).save(sampleUser);
    }

    @Test
    @DisplayName("changePassword - Should throw BadRequestException when current password is wrong")
    void changePassword_WrongCurrentPassword_ShouldThrow() {
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("wrongPass", sampleUser.getPasswordHash())).thenReturn(false);

        ChangePasswordRequest request = new ChangePasswordRequest("wrongPass", "newPass456", "newPass456");
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> profileService.changePassword("admin@example.com", request));

        assertTrue(ex.getMessage().contains("Current password is incorrect"));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("changePassword - Should throw BadRequestException when new password equals current password")
    void changePassword_SamePassword_ShouldThrow() {
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("samePassword123", sampleUser.getPasswordHash())).thenReturn(true);

        ChangePasswordRequest request = new ChangePasswordRequest("samePassword123", "samePassword123", "samePassword123");
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> profileService.changePassword("admin@example.com", request));

        assertTrue(ex.getMessage().contains("different from current password"));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("changePassword - Should throw BadRequestException when confirm password does not match")
    void changePassword_ConfirmMismatch_ShouldThrow() {
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("oldPass123", sampleUser.getPasswordHash())).thenReturn(true);

        ChangePasswordRequest request = new ChangePasswordRequest("oldPass123", "newPass456", "differentConfirm789");
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> profileService.changePassword("admin@example.com", request));

        assertTrue(ex.getMessage().contains("does not match"));
        verify(userRepository, never()).save(any());
    }
}
