package com.example.starter_project_2025.system.rbac.user;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

@Component
@RequiredArgsConstructor
public class StudentUserCodeGenerator {
    private static final int MIN_SUFFIX = 100_000;
    private static final int SUFFIX_RANGE = 900_000;
    private static final int MAX_ATTEMPTS = 100;
    private static final String PREFIX = "SE";

    private final UserRepository users;
    private final SecureRandom random = new SecureRandom();

    public boolean assignIfMissing(User user) {
        if (user.getUserCode() != null && !user.getUserCode().isBlank()) return false;

        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            String code = PREFIX + (MIN_SUFFIX + random.nextInt(SUFFIX_RANGE));
            if (!users.existsByUserCode(code)) {
                user.setUserCode(code);
                return true;
            }
        }
        throw new IllegalStateException("Could not generate a unique student user code after 100 attempts");
    }
}
