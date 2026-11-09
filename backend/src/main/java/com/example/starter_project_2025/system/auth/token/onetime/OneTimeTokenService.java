package com.example.starter_project_2025.system.auth.token.onetime;

import com.example.starter_project_2025.system.rbac.user.User;

import java.time.Duration;

public interface OneTimeTokenService {

    String createOneTimeToken(User user, OneTimeToken.TokenType type);

    /** Same as above, but with a custom lifetime (e.g. 7 days for a "set your password" invitation). */
    String createOneTimeToken(User user, OneTimeToken.TokenType type, Duration lifetime);

    OneTimeToken verifyOneTimeToken(String rawToken, OneTimeToken.TokenType type);

    void markUsed(OneTimeToken token);
}
