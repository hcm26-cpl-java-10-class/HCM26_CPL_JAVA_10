package com.example.starter_project_2025.system.auth.authentication;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.security.UserDetailsServiceImpl;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.auth.authentication.dto.request.LoginRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.RegisterRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.ResetPasswordRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.TokenRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.response.AuthenticationResponse;
import com.example.starter_project_2025.system.auth.token.onetime.OneTimeToken;
import com.example.starter_project_2025.system.auth.token.onetime.OneTimeTokenService;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshToken;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.auth.verify.VerificationService;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthServiceImpl implements AuthService {

    AuthenticationManager authenticationManager;
    UserDetailsServiceImpl userDetailsService;
    VerificationService verificationService;
    RefreshTokenService refreshTokenService;
    OneTimeTokenService oneTimeTokenService;
    AuthMapper authMapper;
    UserRepository userRepository;
    RoleRepository roleRepository;
    PasswordEncoder passwordEncoder;

    @Override
    public AuthenticationResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.email(),
                        request.password()
                )
        );

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();

        refreshTokenService.revokeAllRefreshTokens(principal.getUser().getId());

        String accessToken = refreshTokenService.generateAccessToken(authentication);
        String refreshToken = refreshTokenService.createRefreshToken(principal.getUser());

        return buildAuthResponse(principal, accessToken, refreshToken);
    }

    @Override
    @Transactional
    public AuthenticationResponse loginWithGoogle(String email, String firstName, String lastName) {
        if (!StringUtils.hasText(email)) {
            throw new BadRequestException("Google account email is required");
        }

        User user = userRepository.findByEmail(email)
                .map(existingUser -> updateUserFromGoogleProfile(existingUser, firstName, lastName))
                .orElseGet(() -> createGoogleUser(email, firstName, lastName));

        refreshTokenService.revokeAllRefreshTokens(user.getId());

        UserPrincipal principal = UserPrincipal.fromUser(user);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                principal.getAuthorities()
        );

        String accessToken = refreshTokenService.generateAccessToken(authentication);
        String refreshToken = refreshTokenService.createRefreshToken(user);

        return buildAuthResponse(principal, accessToken, refreshToken);
    }

    @Override
    @Transactional
    public void register(RegisterRequest request) {

        if (userRepository.existsByEmail(request.email())) {
            throw new BadRequestException("Email already exists");
        }

        User user = authMapper.toEntity(request);

        user.setPasswordHash(passwordEncoder.encode(request.password()));

        user.setIsActive(false);

        user.getRoles().add(getDefaultStudentRole());

        userRepository.save(user);

        verificationService.sendEmailVerification(user.getEmail());
    }

    @Override
    @Transactional
    public AuthenticationResponse refresh(TokenRequest request) {

        RefreshToken refreshToken = refreshTokenService.verifyRefreshToken(request.token());

        User user = refreshToken.getUser();

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());

        Authentication authentication = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities()
        );

        String newAccessToken = refreshTokenService.generateAccessToken(authentication);

        String newRefreshToken = refreshTokenService.rotateRefreshToken(refreshToken);

        if (userDetails instanceof UserPrincipal principal) {
            return buildAuthResponse(principal, newAccessToken, newRefreshToken);
        }

        Set<String> roles = resolveRoles(user);
        Set<String> permissions = resolvePermissions(user);
        Map<String, Set<String>> rolePermissions = resolveRolePermissions(user, roles);

        return AuthenticationResponse.builder()
            .accessToken(newAccessToken)
            .refreshToken(newRefreshToken)
            .email(user.getEmail())
            .firstName(user.getFirstName())
            .lastName(user.getLastName())
            .role(roles.stream().findFirst().orElse(null))
            .roles(roles)
            .permissions(permissions)
            .rolePermissions(rolePermissions)
            .build();
    }

    @Override
    public void logout(TokenRequest request) {
        refreshTokenService.revokeRefreshToken(request.token());
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        OneTimeToken resetToken = oneTimeTokenService.verifyOneTimeToken(
                request.token(), OneTimeToken.TokenType.RESET_PASSWORD
        );

        User user = resetToken.getUser();

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        refreshTokenService.revokeAllRefreshTokens(user.getId());

        oneTimeTokenService.markUsed(resetToken);
    }

    private User createGoogleUser(String email, String firstName, String lastName) {
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                .firstName(resolveFirstName(firstName, email))
                .lastName(resolveLastName(lastName))
                .isActive(true)
                .build();

        user.getRoles().add(getDefaultStudentRole());

        return userRepository.save(user);
    }

    private User updateUserFromGoogleProfile(User user, String firstName, String lastName) {
        boolean shouldUpdate = false;

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            user.setIsActive(true);
            shouldUpdate = true;
        }

        if (!StringUtils.hasText(user.getFirstName())) {
            user.setFirstName(resolveFirstName(firstName, user.getEmail()));
            shouldUpdate = true;
        }

        if (!StringUtils.hasText(user.getLastName()) && StringUtils.hasText(lastName)) {
            user.setLastName(resolveLastName(lastName));
            shouldUpdate = true;
        }

        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            user.getRoles().add(getDefaultStudentRole());
            shouldUpdate = true;
        }

        if (!shouldUpdate) {
            return user;
        }

        return userRepository.save(user);
    }

    private Role getDefaultStudentRole() {
        return roleRepository.findByName("STUDENT")
                .orElseThrow(() -> new BadRequestException("Default role STUDENT not found"));
    }

    private String resolveFirstName(String firstName, String email) {
        if (StringUtils.hasText(firstName)) {
            return firstName.trim();
        }

        if (StringUtils.hasText(email) && email.contains("@")) {
            return email.substring(0, email.indexOf('@'));
        }

        return "GoogleUser";
    }

    private String resolveLastName(String lastName) {
        if (StringUtils.hasText(lastName)) {
            return lastName.trim();
        }

        return null;
    }

    private AuthenticationResponse buildAuthResponse(
            UserPrincipal principal,
            String accessToken,
            String refreshToken
    ) {
        User user = principal.getUser();
        Set<String> roles = resolveRoles(user);
        Set<String> permissions = resolvePermissions(user);
        Map<String, Set<String>> rolePermissions = resolveRolePermissions(user, roles);

        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(roles.stream().findFirst().orElse(null))
                .roles(roles)
                .permissions(permissions)
                .rolePermissions(rolePermissions)
                .build();
    }

    private Set<String> resolveRoles(User user) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return new LinkedHashSet<>();
        }

        return user.getRoles().stream()
                .map(Role::getName)
                .filter(StringUtils::hasText)
                .map(this::normalizeRoleName)
                .sorted()
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<String> resolvePermissions(User user) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return new LinkedHashSet<>();
        }

        return user.getRoles().stream()
                .filter(role -> role.getPermissions() != null)
                .flatMap(role -> role.getPermissions().stream())
                .map(permission -> permission.getName())
                .filter(StringUtils::hasText)
                .map(String::trim)
                .sorted()
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Map<String, Set<String>> resolveRolePermissions(User user, Set<String> sortedRoles) {
        Map<String, Set<String>> rolePermissions = new LinkedHashMap<>();

        if (user.getRoles() != null) {
            Map<String, Role> rolesByName = user.getRoles().stream()
                    .filter(role -> StringUtils.hasText(role.getName()))
                    .collect(Collectors.toMap(
                            role -> normalizeRoleName(role.getName()),
                            role -> role,
                            (first, second) -> first,
                            LinkedHashMap::new
                    ));

            for (String roleName : sortedRoles) {
                Role role = rolesByName.get(roleName);
                if (role != null) {
                    rolePermissions.put(roleName, mapRolePermissions(role));
                }
            }
        }

        if (sortedRoles.contains("ADMIN")) {
            includePreviewRolePermissions(rolePermissions, "STUDENT");
            includePreviewRolePermissions(rolePermissions, "TEACHER");
        }

        return rolePermissions;
    }

    private void includePreviewRolePermissions(Map<String, Set<String>> rolePermissions, String roleName) {
        if (rolePermissions.containsKey(roleName)) {
            return;
        }

        roleRepository.findByName(roleName)
                .ifPresent(role -> rolePermissions.put(roleName, mapRolePermissions(role)));
    }

    private Set<String> mapRolePermissions(Role role) {
        if (role.getPermissions() == null || role.getPermissions().isEmpty()) {
            return new LinkedHashSet<>();
        }

        return role.getPermissions().stream()
                .map(permission -> permission.getName())
                .filter(StringUtils::hasText)
                .map(String::trim)
                .sorted()
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private String normalizeRoleName(String roleName) {
        return roleName.trim().toUpperCase();
    }
}
