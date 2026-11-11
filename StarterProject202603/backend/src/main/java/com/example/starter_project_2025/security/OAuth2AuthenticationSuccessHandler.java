package com.example.starter_project_2025.security;

import com.example.starter_project_2025.system.auth.authentication.AuthService;
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
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    AuthService authService;
    CookieUtil cookieUtil;

    @NonFinal
    @Value("${app.frontend-domain}")
    String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        try {
            if (!(authentication.getPrincipal() instanceof OAuth2User oAuth2User)) {
                throw new IllegalStateException("OAuth2 principal is missing");
            }

            Map<String, Object> attributes = oAuth2User.getAttributes();

            String email = getStringAttribute(attributes, "email");
            String firstName = getStringAttribute(attributes, "given_name");
            String lastName = getStringAttribute(attributes, "family_name");

            AuthenticationResponse authResponse = authService.loginWithGoogle(email, firstName, lastName);
            cookieUtil.setRefreshTokenCookie(response, authResponse.getRefreshToken());

            String redirectUrl = UriComponentsBuilder.fromHttpUrl(frontendUrl)
                    .path("/oauth2/redirect")
                    .queryParam("token", authResponse.getAccessToken())
                    .build()
                    .encode()
                    .toUriString();

            getRedirectStrategy().sendRedirect(request, response, redirectUrl);
        } catch (Exception ex) {
            log.error("Google authentication success flow failed", ex);

            String redirectUrl = UriComponentsBuilder.fromHttpUrl(frontendUrl)
                    .path("/login")
                    .queryParam("error", "google_auth_failed")
                    .build()
                    .encode()
                    .toUriString();

            getRedirectStrategy().sendRedirect(request, response, redirectUrl);
        }
    }

    private String getStringAttribute(Map<String, Object> attributes, String key) {
        Object value = attributes.get(key);
        return value instanceof String stringValue ? stringValue : null;
    }
}
