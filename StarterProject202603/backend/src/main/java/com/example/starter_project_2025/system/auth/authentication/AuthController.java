package com.example.starter_project_2025.system.auth.authentication;

import com.example.starter_project_2025.system.auth.authentication.dto.request.ForgotPasswordRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.LoginRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.RegisterRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.ResetPasswordRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.TokenRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.response.AuthenticationResponse;
import com.example.starter_project_2025.system.auth.util.CookieUtil;
import com.example.starter_project_2025.system.auth.verify.VerificationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Authentication", description = "APIs for user authentication and registration")
public class AuthController {

    AuthService authService;
    CookieUtil cookieUtil;
    VerificationService verificationService;

    @PostMapping("/login")
    public ResponseEntity<AuthenticationResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response
    ) {
        AuthenticationResponse authenticationResponse = authService.login(request);

        cookieUtil.setRefreshTokenCookie(response, authenticationResponse.getRefreshToken());
        authenticationResponse.setRefreshToken(null);

        return ResponseEntity.ok(authenticationResponse);
    }

    @PostMapping("/register")
    public ResponseEntity<Void> registerUser(
            @Valid @RequestBody RegisterRequest request
    ) {
        authService.register(request);

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthenticationResponse> refreshToken(
            @CookieValue(value = "refreshToken", required = false) String refreshToken,
            HttpServletResponse response
    ) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        AuthenticationResponse authenticationResponse = authService.refresh(new TokenRequest(refreshToken));

        cookieUtil.setRefreshTokenCookie(response, authenticationResponse.getRefreshToken());
        authenticationResponse.setRefreshToken(null);

        return ResponseEntity.ok(authenticationResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String refreshToken = cookieUtil.getRefreshTokenFromCookie(request)
                .orElse(null);

        if (refreshToken != null) {
            authService.logout(new TokenRequest(refreshToken));
            cookieUtil.clearRefreshTokenCookie(response);
        }

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request
    ) {
        verificationService.sendForgotPassword(request.email());

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resendVerification(
            @RequestParam("email") String email
    ) {
        verificationService.resendVerification(email);

        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(
            @RequestBody ResetPasswordRequest request
    ) {
        authService.resetPassword(request);
        return ResponseEntity.noContent().build();
    }

//    @PreAuthorize("isAuthenticated()")
//    @PostMapping("/switch-role")
//    public ResponseEntity<LoginResponse> getPermissions(HttpServletRequest request, HttpServletResponse response, @RequestBody GetPermissonReqDTO data)
//    {
//        var email = request.getUserPrincipal().getName();
//        var res = authService.switchRole(data, email, response);
//        return ResponseEntity.ok(res);
//    }
}
