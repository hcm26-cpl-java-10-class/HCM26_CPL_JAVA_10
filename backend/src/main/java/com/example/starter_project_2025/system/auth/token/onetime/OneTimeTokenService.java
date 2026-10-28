package com.example.starter_project_2025.system.auth.token.onetime;

import com.example.starter_project_2025.system.rbac.user.User;

public interface OneTimeTokenService {

    String createOneTimeToken(User user, OneTimeToken.TokenType type);

    OneTimeToken verifyOneTimeToken(String rawToken, OneTimeToken.TokenType type);

    void markUsed(OneTimeToken token);
}
