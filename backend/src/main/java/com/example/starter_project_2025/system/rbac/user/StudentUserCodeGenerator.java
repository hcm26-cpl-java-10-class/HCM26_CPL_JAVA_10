
package com.example.starter_project_2025.system.rbac.user;

import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class StudentUserCodeGenerator {

    /**
     * Generate student employee code if it does not exist.
     *
     * @param user student user account
     * @return true if a new code was assigned
     */
    public boolean assignIfMissing(User user) {

        if (user == null) {
            return false;
        }

        // Keep existing employee code
        if (user.getEmployeeCode() != null
                && !user.getEmployeeCode().isBlank()) {
            return false;
        }

        // Generate a new unique-looking student code
        String code = "STU-" + UUID.randomUUID()
                .toString()
                .replace("-", "")
                .substring(0, 10)
                .toUpperCase();

        user.setEmployeeCode(code);

        return true;
    }
}
