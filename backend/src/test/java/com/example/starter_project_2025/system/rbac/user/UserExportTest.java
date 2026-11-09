package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.dataio.exporter.builder.ExportConfigBuilder;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportColumn;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;
import com.example.starter_project_2025.base.dataio.exporter.metadata.ExportMetadataCache;
import com.example.starter_project_2025.base.dataio.exporter.resolver.ExportValueResolver;
import com.example.starter_project_2025.base.dataio.exporter.resolver.RelationResolverEngine;
import com.example.starter_project_2025.system.rbac.role.Role;
import org.hibernate.proxy.HibernateProxy;
import org.hibernate.proxy.LazyInitializer;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;

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
    void rolesAreWritten_evenWhenLazyLoadingHandsOverAProxyLikeSubclass() {
        Role role = new Role();
        role.setName("STUDENT");

        // 1. Test generated subclass reflection: subclass without entity fields (tests findField superclass traversal)
        Role proxyLike = new Role() { };
        proxyLike.setName("TEACHER");

        // 2. Test actual HibernateProxy unproxying: proxy implementing HibernateProxy interface
        Role realAdminRole = new Role();
        realAdminRole.setName("ADMIN");
        Role hibernateProxy = mock(Role.class, withSettings().extraInterfaces(HibernateProxy.class));
        LazyInitializer lazyInitializer = mock(LazyInitializer.class);
        when(((HibernateProxy) hibernateProxy).asHibernateProxy()).thenReturn((HibernateProxy) hibernateProxy);
        when(((HibernateProxy) hibernateProxy).getHibernateLazyInitializer()).thenReturn(lazyInitializer);
        when(lazyInitializer.getImplementation()).thenReturn(realAdminRole);

        User user = new User();
        user.setEmail("a@example.com");
        Set<Role> roles = new HashSet<>();
        roles.add(role);
        roles.add(proxyLike);
        roles.add(hibernateProxy);
        user.setRoles(roles);

        ExportSheetConfig<User> config = builder.build(User.class);

        Object rolesValue = cell(config, "Roles", user);
        assertNotNull(rolesValue, "Roles column value must not be null");
        String rolesStr = rolesValue.toString();
        assertTrue(rolesStr.contains("STUDENT"), "Roles export should contain STUDENT");
        assertTrue(rolesStr.contains("TEACHER"), "Roles export should contain TEACHER from proxy subclass");
        assertTrue(rolesStr.contains("ADMIN"), "Roles export should contain ADMIN from HibernateProxy");
        assertNotNull(cell(config, "Email", user));
    }
}
