package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:class_stats_tests;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@Transactional
class ClassStatisticsIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired TrainingClassRepository classes;
    @Autowired RefreshTokenService tokens;
    @Autowired UserDetailsService users;
    @MockBean Clock clock;
    String token;
    final LocalDate today = LocalDate.of(2026, 11, 7);

    @BeforeEach void setup() {
        when(clock.getZone()).thenReturn(ZoneId.of("Asia/Ho_Chi_Minh"));
        when(clock.instant()).thenReturn(Instant.parse("2026-11-06T18:00:00Z"));
        var admin = users.loadUserByUsername("admin@example.com");
        token = tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
    }

    private void add(String code, String status, int days, boolean active) {
        var entity = new TrainingClass();
        entity.setCode(code); entity.setName(code); entity.setStatus(status);
        entity.setStartDate(today.plusDays(days)); entity.setEndDate(today.plusDays(days + 90));
        entity.setPlannedSize(20); entity.setIsActive(active); classes.saveAndFlush(entity);
    }

    @Test void emptyDatabaseReturnsZero() throws Exception {
        mvc.perform(get("/api/classes/stats").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalClasses").value(0))
            .andExpect(jsonPath("$.inProgress").value(0)).andExpect(jsonPath("$.upcomingClasses").value(0))
            .andExpect(jsonPath("$.completedClasses").value(0));
    }

    @Test void countsRealStatusesAndInclusiveDateBoundariesWithoutSoftDeletedRows() throws Exception {
        add("STATS_TODAY", "planning", 0, true);
        add("STATS_LAST", "assigned", 30, true);
        add("STATS_PAST", "planning", -1, true);
        add("STATS_LATER", "assigned", 31, true);
        add("STATS_ACTIVE", "active", 1, true);
        add("STATS_DONE", "completed", -50, true);
        add("STATS_CLOSED", "closed", -50, true);
        add("STATS_CANCEL", "cancelled", 1, true);
        add("STATS_DELETED", "planning", 1, false);
        mvc.perform(get("/api/classes").param("size", "1").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1));
        mvc.perform(get("/api/classes/stats").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalClasses").value(8))
            .andExpect(jsonPath("$.inProgress").value(1)).andExpect(jsonPath("$.upcomingClasses").value(2))
            .andExpect(jsonPath("$.completedClasses").value(2)).andExpect(jsonPath("$.asOf").value("2026-11-07"))
            .andExpect(jsonPath("$.upcomingThrough").value("2026-12-07"));
    }

    @Test void requiresAuthenticationAndClassRead() throws Exception {
        mvc.perform(get("/api/classes/stats")).andExpect(status().isUnauthorized());
        var student = users.loadUserByUsername("student@example.com");
        var studentToken = tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(student, null, student.getAuthorities()));
        mvc.perform(get("/api/classes/stats").header("Authorization", "Bearer " + studentToken))
            .andExpect(status().isForbidden());
    }
}
