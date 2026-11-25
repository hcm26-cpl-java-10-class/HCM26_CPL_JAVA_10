package com.example.starter_project_2025.system.profile;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.profile.dto.ChangePasswordRequest;
import com.example.starter_project_2025.system.profile.dto.UpdateProfileRequest;
import com.example.starter_project_2025.system.profile.dto.UserProfileResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/profile")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Personal Profile", description = "APIs for viewing and managing user personal profile and security")
@SecurityRequirement(name = "bearerAuth")
public class ProfileController {

    ProfileService profileService;

    @GetMapping
    @Operation(summary = "Retrieve authenticated user profile", description = "Returns personal details and account status of the current user")
    public ResponseEntity<UserProfileResponse> getProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            Principal fallbackPrincipal
    ) {
        String email = resolveEmail(principal, fallbackPrincipal);
        return ResponseEntity.ok(profileService.getProfile(email));
    }

    @PutMapping
    @Operation(summary = "Update authenticated user profile", description = "Updates full name and phone number for the current user")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            Principal fallbackPrincipal,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        String email = resolveEmail(principal, fallbackPrincipal);
        return ResponseEntity.ok(profileService.updateProfile(email, request));
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change authenticated user password", description = "Validates current password and updates with new password")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            Principal fallbackPrincipal,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        String email = resolveEmail(principal, fallbackPrincipal);
        profileService.changePassword(email, request);
        return ResponseEntity.noContent().build();
    }

    private String resolveEmail(UserPrincipal principal, Principal fallbackPrincipal) {
        if (principal != null) {
            return principal.getUsername();
        }

        if (fallbackPrincipal != null) {
            if (fallbackPrincipal instanceof Authentication auth && auth.getPrincipal() instanceof UserPrincipal up) {
                return up.getUsername();
            }
            return fallbackPrincipal.getName();
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            if (auth.getPrincipal() instanceof UserPrincipal up) {
                return up.getUsername();
            }
            return auth.getName();
        }

        throw new AccessDeniedException("User is not authenticated");
    }
}
