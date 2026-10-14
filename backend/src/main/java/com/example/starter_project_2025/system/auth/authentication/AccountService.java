package com.example.starter_project_2025.system.auth.authentication;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.auth.authentication.dto.request.UpdateProfileRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.response.ProfileResponse;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;

/** Profile operations for the currently logged-in user. */
@Service
@RequiredArgsConstructor
public class AccountService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public ProfileResponse getProfile(Long userId) {
        return toResponse(findUser(userId));
    }

    @Transactional
    public ProfileResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = findUser(userId);

        user.setFirstName(request.firstName().trim());
        String lastName = request.lastName() == null ? null : request.lastName().trim();
        user.setLastName(lastName == null || lastName.isEmpty() ? null : lastName);

        return toResponse(userRepository.save(user));
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException("User not found"));
    }

    private ProfileResponse toResponse(User user) {
        return ProfileResponse.builder()
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .roles(user.getRoles().stream()
                        .map(Role::getName)
                        .sorted(Comparator.naturalOrder())
                        .toList())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
