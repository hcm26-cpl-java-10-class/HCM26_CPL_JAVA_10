package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.dataio.exporter.builder.ExportConfigBuilder;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportColumn;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;
import com.example.starter_project_2025.base.dataio.exporter.metadata.ExportMetadataCache;
import com.example.starter_project_2025.base.dataio.exporter.resolver.ExportValueResolver;
import com.example.starter_project_2025.base.dataio.exporter.resolver.RelationResolverEngine;
import com.example.starter_project_2025.system.rbac.department.Department;
import com.example.starter_project_2025.system.rbac.role.Role;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Export: the Password column exists but is always empty, and relations are written out. */
class UserExportTest {

    private final ExportConfigBuilder builder = new ExportConfigBuilder(
            new ExportMetadataCache(),
            new ExportValueResolver(new RelationResolverEngine()));

    private static Object cell(ExportSheetConfig<User> config, String header, User user) {
        for (ExportColumn<User> column : config.columns()) {
            if (column.header().equals(header)) {
                return column.valueExtractor().apply(user);
            }
        }
        return null;
    }

    @Test
    void passwordColumnIsPresentButAlwaysEmpty_andTheHashIsNeverExported() {
        User user = new User();
        user.setEmail("a@example.com");
        user.setFirstName("A");
        user.setPasswordHash("$2a$10$secretsecretsecretsecretsecretsecretsecretsecretsecretse");
        user.setPassword("should-never-appear"); // even if something filled the transient field in memory

        ExportSheetConfig<User> config = builder.build(User.class);

        List<String> headers = config.columns().stream().map(ExportColumn::header).toList();
        assertTrue(headers.contains("Password"));

        assertEquals("", cell(config, "Password", new User()));
        for (ExportColumn<User> column : config.columns()) {
            Object value = column.valueExtractor().apply(user);
            assertFalse(String.valueOf(value).contains("$2a$"), column.header());
        }
    }

    @Test
    void rolesAndDepartmentsAreWritten_evenWhenLazyLoadingHandsOverAProxyLikeSubclass() {
        Role role = new Role();
        role.setName("STUDENT");

        // A Hibernate proxy is a generated subclass without the entity's own fields. This anonymous
        // subclass behaves the same way, and used to make the whole export fail (empty file).
        Department proxyLike = new Department() { };
        proxyLike.setCode("FPT");
        proxyLike.setName("FPT Academy");

        User user = new User();
        user.setEmail("a@example.com");
        Set<Role> roles = new HashSet<>();
        roles.add(role);
        user.setRoles(roles);
        Set<Department> departments = new HashSet<>();
        departments.add(proxyLike);
        user.setDepartments(departments);

        ExportSheetConfig<User> config = builder.build(User.class);

        assertEquals("STUDENT", cell(config, "Roles", user));
        assertEquals("FPT", cell(config, "Departments", user));
        assertNotNull(cell(config, "Email", user));
    }
}
