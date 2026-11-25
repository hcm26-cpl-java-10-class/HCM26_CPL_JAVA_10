package com.example.starter_project_2025.service;

import com.example.starter_project_2025.init.RoleDataInitializer;
import com.example.starter_project_2025.system.rbac.role.*;
import com.example.starter_project_2025.system.rbac.permission.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RoleAccessMigrationTest {
    @Test void migrationSeparatesLearningAndPreservesCustomMappingsOnRestart() {
        var roles = mock(RoleRepository.class);
        var permissions = mock(PermissionRepository.class);
        Map<String, Permission> permissionMap = new HashMap<>();
        for (String name : List.of("USER_READ", "ENROLLMENT_READ", "COURSE_UPDATE")) {
            permissionMap.put(name, Permission.builder().name(name).build());
        }
        Map<String, Role> roleMap = new HashMap<>();
        roleMap.put("ADMIN", Role.builder().name("ADMIN").description("Customized admin")
                .permissions(new HashSet<>(permissionMap.values())).build());
        roleMap.put("STUDENT", Role.builder().name("STUDENT")
                .permissions(new HashSet<>(Set.of(permissionMap.get("ENROLLMENT_READ")))).build());
        roleMap.put("CUSTOM_MANAGER", Role.builder().name("CUSTOM_MANAGER")
                .permissions(new HashSet<>(Set.of(permissionMap.get("COURSE_UPDATE")))).build());
        roleMap.put("CUSTOM_LEARNER", Role.builder().name("CUSTOM_LEARNER")
                .permissions(new HashSet<>(Set.of(permissionMap.get("ENROLLMENT_READ")))).build());
        when(permissions.existsByName(anyString())).thenAnswer(i -> permissionMap.containsKey(i.getArgument(0)));
        when(permissions.findByName(anyString())).thenAnswer(i -> Optional.ofNullable(permissionMap.get(i.getArgument(0))));
        when(permissions.findAll()).thenAnswer(i -> new ArrayList<>(permissionMap.values()));
        when(permissions.save(any(Permission.class))).thenAnswer(i -> {
            Permission p = i.getArgument(0); permissionMap.put(p.getName(), p); return p;
        });
        when(roles.findByName(anyString())).thenAnswer(i -> Optional.ofNullable(roleMap.get(i.getArgument(0))));
        when(roles.findAll()).thenAnswer(i -> new ArrayList<>(roleMap.values()));
        when(roles.save(any(Role.class))).thenAnswer(i -> {
            Role r = i.getArgument(0); roleMap.put(r.getName(), r); return r;
        });
        var initializer = new RoleDataInitializer(roles, permissions);
        initializer.run();
        var admin = roleMap.get("ADMIN");
        assertEquals("Customized admin", admin.getDescription());
        assertTrue(admin.getPermissions().contains(permissionMap.get("COURSE_UPDATE")));
        assertTrue(admin.getPermissions().contains(permissionMap.get("ADMIN_ACCESS")));
        assertFalse(admin.getPermissions().contains(permissionMap.get("ENROLLMENT_READ")));
        assertFalse(admin.getPermissions().contains(permissionMap.get("LEARNER_ACCESS")));
        assertTrue(roleMap.get("STUDENT").getPermissions().contains(permissionMap.get("LEARNER_ACCESS")));
        assertTrue(roleMap.get("CUSTOM_MANAGER").getPermissions().contains(permissionMap.get("ADMIN_ACCESS")));
        assertFalse(roleMap.get("CUSTOM_MANAGER").getPermissions().contains(permissionMap.get("LEARNER_ACCESS")));
        assertTrue(roleMap.get("CUSTOM_LEARNER").getPermissions().contains(permissionMap.get("LEARNER_ACCESS")));
        assertFalse(roleMap.get("CUSTOM_LEARNER").getPermissions().contains(permissionMap.get("USER_LEARNING_READ")));
        assertTrue(roleMap.get("TEACHER").getPermissions().contains(permissionMap.get("ADMIN_ACCESS")));
        assertFalse(roleMap.get("TEACHER").getPermissions().contains(permissionMap.get("LEARNER_ACCESS")));
        var dual = com.example.starter_project_2025.security.UserPrincipal.fromUser(
                com.example.starter_project_2025.system.rbac.user.User.builder()
                .roles(Set.of(admin, roleMap.get("STUDENT"))).build());
        assertTrue(dual.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("LEARNER_ACCESS")));
        assertTrue(dual.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("USER_LEARNING_READ")));
        admin.getPermissions().remove(permissionMap.get("USER_LEARNING_READ"));
        initializer.run();
        assertFalse(admin.getPermissions().contains(permissionMap.get("USER_LEARNING_READ")));
    }
}
