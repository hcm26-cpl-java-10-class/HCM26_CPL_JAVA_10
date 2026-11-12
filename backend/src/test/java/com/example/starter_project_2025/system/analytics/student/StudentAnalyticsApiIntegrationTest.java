package com.example.starter_project_2025.system.analytics.student;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.menu.module.ModuleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StudentAnalyticsApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UserDetailsService users;
    @Autowired RefreshTokenService tokens;
    @Autowired TransactionTemplate transaction;
    @Autowired ModuleRepository modules;

    private String token(String email) {
        return transaction.execute(status -> {
            var user = users.loadUserByUsername(email);
            return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        });
    }

    @Test
    void onlyAdminAndTeacherCanAccessReport() throws Exception {
        String path = "/api/analytics/students?from=2026-01-01&to=2026-12-31&interval=MONTH";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get(path).header("Authorization", "Bearer " + token("student@example.com")))
                .andExpect(status().isForbidden());
        mvc.perform(get(path).header("Authorization", "Bearer " + token("admin@example.com")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.newStudents").isArray())
                .andExpect(jsonPath("$.activity").isArray()).andExpect(jsonPath("$.completionRate").exists());
        mvc.perform(get(path).header("Authorization", "Bearer " + token("teacher@example.com")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.courses").isArray());
    }

    @Test
    void analyticsMenuIsRegisteredWithItsOwnPermission() {
        transaction.executeWithoutResult(status -> {
            var menu = modules.findByUrl("/analytics/students").orElseThrow();
            assertEquals("Analytics", menu.getModuleGroup().getName());
            assertEquals("STUDENT_ANALYTICS_READ", menu.getRequiredPermission());
        });
    }
}
