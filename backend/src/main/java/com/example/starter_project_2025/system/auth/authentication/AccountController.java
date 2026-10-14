package com.example.starter_project_2025.system.auth.authentication;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.auth.authentication.dto.request.ChangePasswordRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.UpdateProfileRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.response.ProfileResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints for the currently logged-in user.
 * Kept outside /api/auth/** because the JWT filter skips that prefix.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/account")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Account", description = "APIs for the current user's account")
public class AccountController {

    AuthService authService;
    AccountService accountService;

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/profile")
    public ResponseEntity<ProfileResponse> getProfile(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(accountService.getProfile(principal.getUser().getId()));
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/profile")
    public ResponseEntity<ProfileResponse> updateProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        return ResponseEntity.ok(accountService.updateProfile(principal.getUser().getId(), request));
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/change-password")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        authService.changePassword(principal.getUser().getId(), request);
        return ResponseEntity.noContent().build();
    }
}
