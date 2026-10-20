package com.example.starter_project_2025.system.profile;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.profile.dto.ChangePasswordRequest;
import com.example.starter_project_2025.system.profile.dto.UpdateProfileRequest;
import com.example.starter_project_2025.system.profile.dto.UserProfileResponse;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProfileServiceImpl implements ProfileService {

    UserRepository userRepository;
    PasswordEncoder passwordEncoder;

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(String email) {
        User user = findUserByEmail(email);
        return mapToResponse(user);
    }

    @Override
    public UserProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = findUserByEmail(email);

        String trimmedName = request.fullName().trim();
        int firstSpace = trimmedName.indexOf(' ');
        if (firstSpace > 0) {
            user.setFirstName(trimmedName.substring(0, firstSpace).trim());
            user.setLastName(trimmedName.substring(firstSpace + 1).trim());
        } else {
            user.setFirstName(trimmedName);
            user.setLastName("");
        }

        user.setPhoneNumber(request.phoneNumber().trim());

        User saved = userRepository.save(user);
        return mapToResponse(saved);
    }

    @Override
    public void changePassword(String email, ChangePasswordRequest request) {
        User user = findUserByEmail(email);

        // Verify current password against stored hash
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }

        // Prevent reusing same password
        if (request.currentPassword().equals(request.newPassword())) {
            throw new BadRequestException("New password must be different from current password");
        }

        // Verify confirm password match if supplied
        if (request.confirmNewPassword() != null && !request.confirmNewPassword().isBlank()) {
            if (!request.newPassword().equals(request.confirmNewPassword())) {
                throw new BadRequestException("Confirm new password does not match new password");
            }
        }

        // Update password with BCrypt hash
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    private User findUserByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + email));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new AccessDeniedException("User account is inactive or disabled");
        }

        return user;
    }

    private UserProfileResponse mapToResponse(User user) {
        Set<String> roleNames = user.getRoles() != null
                ? user.getRoles().stream().map(Role::getName).collect(Collectors.toSet())
                : Set.of();

        String primaryRole = resolvePrimaryRole(roleNames);

        return UserProfileResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .employeeCode(user.getEmployeeCode() != null ? user.getEmployeeCode() : "")
                .phoneNumber(user.getPhoneNumber() != null ? user.getPhoneNumber() : "")
                .role(primaryRole)
                .roles(roleNames)
                .department(user.getDepartment() != null ? user.getDepartment() : "")
                .status(Boolean.TRUE.equals(user.getIsActive()) ? "Active" : "Inactive")
                .lastLogin(null)
                .device(null)
                .skills(List.of("Java", "Curriculum", "Agile"))
                .build();
    }

    private String resolvePrimaryRole(Set<String> roles) {
        if (roles.contains("ADMIN")) return "ADMIN";
        if (roles.contains("PROGRAM_MANAGER") || roles.contains("PROGRAM MANAGER")) return "PROGRAM MANAGER";
        if (roles.contains("TEACHER")) return "TEACHER";
        if (roles.contains("STUDENT")) return "STUDENT";
        return roles.stream().findFirst().orElse("USER");
    }
}
