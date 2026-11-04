
package com.example.starter_project_2025.security;

import com.example.starter_project_2025.system.auth.authentication.AuthService;
import com.example.starter_project_2025.system.auth.authentication.SsoLoginException;
import com.example.starter_project_2025.system.auth.authentication.dto.response.AuthenticationResponse;
import com.example.starter_project_2025.system.auth.util.CookieUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.Map;

@Component
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class OAuth2AuthenticationSuccessHandler
        extends SimpleUrlAuthenticationSuccessHandler {

    AuthService authService;
    CookieUtil cookieUtil;

    @NonFinal
    @Value("${app.frontend-domain}")
    String frontendUrl;

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) throws IOException {

        log.info("Google OAuth success handler reached");

        try {
            if (!(authentication.getPrincipal() instanceof OAuth2User oAuth2User)) {
                throw new IllegalStateException("OAuth2 principal is missing");
            }

            Map<String, Object> attributes = oAuth2User.getAttributes();

            String email = getStringAttribute(attributes, "email");
            String firstName = getStringAttribute(attributes, "given_name");
            String lastName = getStringAttribute(attributes, "family_name");
            boolean emailVerified = isTrue(attributes.get("email_verified"));

            log.info("Google email available: {}", email != null && !email.isBlank());
            log.info("Google email verified: {}", emailVerified);

            AuthenticationResponse authResponse =
                    authService.loginWithGoogle(
                            email, emailVerified, firstName, lastName);

            log.info("loginWithGoogle completed");

            if (authResponse == null
                    || authResponse.getAccessToken() == null
                    || authResponse.getAccessToken().isBlank()) {
                throw new IllegalStateException(
                        "Access token is missing from AuthenticationResponse");
            }

            String accessToken = authResponse.getAccessToken();

            log.info("Access token exists: true");

            if (authResponse.getRefreshToken() != null
                    && !authResponse.getRefreshToken().isBlank()) {
                cookieUtil.setRefreshTokenCookie(
                        response, authResponse.getRefreshToken());
            }

            String baseUrl = frontendUrl.replaceAll("/+$", "");

            String redirectUrl = baseUrl
                    + "/oauth2/redirect#token="
                    + accessToken;

            log.info("Redirecting Google login to frontend OAuth callback");

            getRedirectStrategy().sendRedirect(
                    request, response, redirectUrl);

        } catch (SsoLoginException ex) {
            log.warn(
                    "Google sign-in refused. Code: {}, message: {}",
                    ex.getCode(), ex.getMessage());

            redirectToLogin(request, response, ex.getCode());

        } catch (Exception ex) {
            log.error("Google authentication success flow failed", ex);

            redirectToLogin(
                    request,
                    response,
                    SsoLoginException.AUTH_FAILED);
        }
    }

    private void redirectToLogin(
            HttpServletRequest request,
            HttpServletResponse response,
            String errorCode) throws IOException {

        String redirectUrl = UriComponentsBuilder
                .fromHttpUrl(frontendUrl)
                .path("/login")
                .queryParam("error", errorCode)
                .build()
                .encode()
                .toUriString();

        getRedirectStrategy().sendRedirect(
                request, response, redirectUrl);
    }

    private boolean isTrue(Object value) {
        return value instanceof Boolean flag
                ? flag
                : "true".equalsIgnoreCase(String.valueOf(value));
    }

    private String getStringAttribute(
            Map<String, Object> attributes,
            String key) {

        Object value = attributes.get(key);

        return value instanceof String stringValue
                ? stringValue
                : null;
    }
}
