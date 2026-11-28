package com.example.starter_project_2025.security;

import com.example.starter_project_2025.system.audit.guard.RequestAbuseFilter;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import jakarta.annotation.Nonnull;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Set<String> SKIPPED_AUTH_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/refresh",
            "/api/auth/forgot-password",
            "/api/auth/reset-password",
            "/api/auth/resend-verification"
    );
    private static final Logger LOGGER = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    RefreshTokenService refreshTokenService;
    UserDetailsServiceImpl userDetailsService;
    TenantRepository tenantRepository;

    @Override
    protected void doFilterInternal(@Nonnull HttpServletRequest request,
                                    @Nonnull HttpServletResponse response,
                                    @Nonnull FilterChain filterChain)
            throws ServletException, IOException {

        try {
            String token = getTokenFromRequest(request);

            if (token != null) {

                Jwt jwt = refreshTokenService.decodeAccessToken(token);

                String sessionId = jwt.getClaimAsString("sid");
                if (StringUtils.hasText(sessionId) && !refreshTokenService.isSessionActive(sessionId)) {
                    SecurityContextHolder.clearContext();
                    if (!"/api/auth/logout".equals(request.getServletPath())) {
                        writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED,
                                "SESSION_REVOKED", "Session has been revoked or expired. Please sign in again.");
                        return;
                    }
                    filterChain.doFilter(request, response);
                    return;
                }

                UserDetails userDetails = userDetailsService.loadUserByUsername(jwt.getSubject());

                request.setAttribute(RequestAbuseFilter.ATTR_USER_EMAIL, userDetails.getUsername());
                if (userDetails instanceof UserPrincipal principal) {
                    request.setAttribute(RequestAbuseFilter.ATTR_USER_ID, principal.getUser().getId());
                }

                if (!userDetails.isAccountNonLocked()
                        || !userDetails.isEnabled()) {
                    SecurityContextHolder.clearContext();
                    request.setAttribute(RequestAbuseFilter.ATTR_SKIP, true);
                    writeJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            "ACCOUNT_INACTIVE", "Account is locked or disabled");
                    return;
                }

                if (userDetails instanceof UserPrincipal principal && principal.getUser().getTenantId() != null) {
                    boolean tenantActive = tenantRepository.findById(principal.getUser().getTenantId())
                            .map(Tenant::getActive)
                            .map(Boolean.TRUE::equals)
                            .orElse(true);
                    if (!tenantActive) {
                        SecurityContextHolder.clearContext();
                        writeJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                                "TENANT_INACTIVE", "Organization tenant is currently inactive");
                        return;
                    }
                }

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );

                authentication.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request)
                );

                SecurityContextHolder.getContext().setAuthentication(authentication);
            }

        } catch (JwtException | UsernameNotFoundException ex) {
            LOGGER.warn("JWT authentication failed on path {}: {}", request.getServletPath(), ex.getMessage());
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path != null && SKIPPED_AUTH_PATHS.contains(path);
    }

    private String getTokenFromRequest(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");

        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }

        return null;
    }

    private void writeJsonError(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(
                "{\"status\":" + status + ",\"code\":\"" + code + "\",\"message\":\"" + message + "\"}"
        );
    }
}
