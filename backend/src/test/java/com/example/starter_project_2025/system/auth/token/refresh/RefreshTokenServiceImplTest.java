package com.example.starter_project_2025.system.auth.token.refresh;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RefreshTokenServiceImplTest {

    @Test
    void compactRolePermissionsForToken_removesOnlyDuplicatedAdminEntry() {
        Map<String, Set<String>> rolePermissions = new LinkedHashMap<>();
        rolePermissions.put("ADMIN", Set.of("USER_READ", "ROLE_READ"));
        rolePermissions.put("STUDENT", Set.of("BOOK_READ"));
        rolePermissions.put("TEACHER", Set.of("BOOK_READ", "BOOK_UPDATE"));

        RefreshTokenServiceImpl.compactRolePermissionsForToken(
                Set.of("ADMIN"),
                rolePermissions
        );

        assertFalse(rolePermissions.containsKey("ADMIN"));
        assertTrue(rolePermissions.containsKey("STUDENT"));
        assertTrue(rolePermissions.containsKey("TEACHER"));
        assertEquals(Set.of("BOOK_READ"), rolePermissions.get("STUDENT"));
    }

    @Test
    void compactRolePermissionsForToken_keepsRoleMapForNonAdmin() {
        Map<String, Set<String>> rolePermissions = new LinkedHashMap<>();
        rolePermissions.put("TEACHER", Set.of("BOOK_READ", "BOOK_UPDATE"));

        RefreshTokenServiceImpl.compactRolePermissionsForToken(
                Set.of("TEACHER"),
                rolePermissions
        );

        assertTrue(rolePermissions.containsKey("TEACHER"));
    }
}
