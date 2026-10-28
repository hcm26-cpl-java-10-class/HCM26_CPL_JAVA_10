package com.example.starter_project_2025.controller;

import com.example.starter_project_2025.security.*;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class JwtAuthorityRefreshTest {
    @Test void existingJwtUsesCurrentDatabaseAuthoritiesOnEachRequest() throws Exception {
        var tokens = mock(RefreshTokenService.class);
        var users = mock(UserDetailsServiceImpl.class);
        var jwt = Jwt.withTokenValue("old-jwt").header("alg", "RS256").subject("user@example.com")
                .claim("permissions", List.of("USER_LEARNING_READ")).build();
        when(tokens.decodeAccessToken("old-jwt")).thenReturn(jwt);
        var principal = new UserPrincipal(com.example.starter_project_2025.system.rbac.user.User.builder()
                .email("user@example.com").isActive(true).locked(false).build(),
                List.of(new SimpleGrantedAuthority("LEARNER_ACCESS")));
        when(users.loadUserByUsername("user@example.com")).thenReturn(principal);
        var filter = new JwtAuthenticationFilter(tokens, users);
        var request = new MockHttpServletRequest("GET", "/api/learning/me");
        request.addHeader("Authorization", "Bearer old-jwt");
        try {
            filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {
                var authorities = SecurityContextHolder.getContext().getAuthentication().getAuthorities();
                assertTrue(authorities.stream().anyMatch(a -> a.getAuthority().equals("LEARNER_ACCESS")));
                assertFalse(authorities.stream().anyMatch(a -> a.getAuthority().equals("USER_LEARNING_READ")));
            });
            verify(users).loadUserByUsername("user@example.com");
        } finally { SecurityContextHolder.clearContext(); }
    }
    @Test void inactiveAssignedRoleCannotGrantAccess() {
        var permission = com.example.starter_project_2025.system.rbac.permission.Permission.builder()
                .name("USER_LEARNING_READ").build();
        var disabled = com.example.starter_project_2025.system.rbac.role.Role.builder()
                .name("CUSTOM_AUDITOR").isActive(false).permissions(java.util.Set.of(permission)).build();
        var principal = UserPrincipal.fromUser(com.example.starter_project_2025.system.rbac.user.User.builder()
                .roles(java.util.Set.of(disabled)).build());
        assertTrue(principal.getAuthorities().isEmpty());
    }
}
