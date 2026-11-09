package com.example.starter_project_2025.system.auth.authentication;

import com.example.starter_project_2025.system.rbac.user.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Who may sign in through single sign-on (Google).
 *
 * <ul>
 *   <li>The email must be verified by the provider.</li>
 *   <li>{@code app.sso.allowed-domains} (comma separated, empty = any domain) limits the email domain.</li>
 *   <li>The email must belong to an account that already exists (imported or created by an administrator).
 *       {@code app.sso.auto-create-users=true} brings back the old open sign-up that creates a STUDENT
 *       account for anyone with a Google account; it is off by default.</li>
 *   <li>Locked and inactive accounts cannot sign in.</li>
 * </ul>
 */
@Component
public class SsoAccessPolicy {

    private final Set<String> allowedDomains;
    private final boolean autoCreateUsers;

    public SsoAccessPolicy(
            @Value("${app.sso.allowed-domains:}") String allowedDomains,
            @Value("${app.sso.auto-create-users:false}") boolean autoCreateUsers) {

        this.allowedDomains = Arrays.stream(allowedDomains.split(","))
                .map(String::trim)
                .map(domain -> domain.startsWith("@") ? domain.substring(1) : domain)
                .map(domain -> domain.toLowerCase(Locale.ROOT))
                .filter(domain -> !domain.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
        this.autoCreateUsers = autoCreateUsers;
    }

    public boolean autoCreateUsers() {
        return autoCreateUsers;
    }

    /** Checks what the provider told us about the email address. */
    public void checkEmail(String email, boolean emailVerified) {
        if (!emailVerified) {
            throw new SsoLoginException(SsoLoginException.EMAIL_UNVERIFIED,
                    "The Google email address is not verified");
        }

        if (!allowedDomains.isEmpty()) {
            String domain = email.substring(email.lastIndexOf('@') + 1).toLowerCase(Locale.ROOT);
            if (!allowedDomains.contains(domain)) {
                throw new SsoLoginException(SsoLoginException.DOMAIN_NOT_ALLOWED,
                        "Email domain is not allowed: " + domain);
            }
        }
    }

    public SsoLoginException notRegistered(String email) {
        return new SsoLoginException(SsoLoginException.NOT_REGISTERED,
                "No account exists for " + email);
    }

    /** A locked or inactive account must not get in through SSO either. */
    public void checkAccount(User user) {
        if (Boolean.TRUE.equals(user.getLocked())) {
            throw new SsoLoginException(SsoLoginException.ACCOUNT_LOCKED, "Account is locked");
        }
        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new SsoLoginException(SsoLoginException.ACCOUNT_DISABLED, "Account is inactive");
        }
    }
}
