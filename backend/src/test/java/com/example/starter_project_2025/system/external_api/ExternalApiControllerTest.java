package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ExternalApiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @MockBean
    private ExternalApiService externalApiService;

    private String studentToken;

    @BeforeEach
    void setUp() {
        reset(externalApiService);
        transactionTemplate.executeWithoutResult(status -> {
            UserDetails student = userDetailsService.loadUserByUsername("student@example.com");
            studentToken = refreshTokenService.generateAccessToken(
                    new UsernamePasswordAuthenticationToken(student, null, student.getAuthorities()));
        });
    }

    @Test
    void calendars_RequireSessionReadAndReturnClassHistory() throws Exception {
        mockMvc.perform(get("/api/external/classes/1/calendars").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());

        String adminToken = transactionTemplate.execute(status -> {
            UserDetails admin = userDetailsService.loadUserByUsername("admin@example.com");
            return refreshTokenService.generateAccessToken(
                    new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
        });
        when(externalApiService.fetchClassCalendars(1L)).thenReturn(List.of(java.util.Map.of("id", 109, "status", "active")));
        mockMvc.perform(get("/api/external/classes/1/calendars").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(109));
        verify(externalApiService).fetchClassCalendars(1L);

        String updates = "{\"updates\":[{\"id\":109,\"name\":\"Calendar 1.9\",\"historyChange\":\"Update plan\"}]}";
        mockMvc.perform(put("/api/external/classes/1/calendars").contentType("application/json").content(updates)
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/external/classes/1/calendars").contentType("application/json").content(updates)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
        verify(externalApiService).saveClassCalendars(org.mockito.ArgumentMatchers.eq(1L), any());
    }

    @Test
    @DisplayName("GET /api/external/classes - defaults to active classes")
    void classes_DefaultsToActive() throws Exception {
        when(externalApiService.fetchClasses("active")).thenReturn(List.of(ExternalClassDTO.builder().id(1L).code("A").build()));

        mockMvc.perform(get("/api/external/classes").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
        verify(externalApiService).fetchClasses("active");
    }

    @Test
    @DisplayName("GET /api/external/classes?status=all - asks the master system for classes of every status")
    void classes_StatusAll_SendsNoStatusUpstream() throws Exception {
        when(externalApiService.fetchClasses(null)).thenReturn(List.of(
                ExternalClassDTO.builder().id(1L).status("active").build(),
                ExternalClassDTO.builder().id(2L).status("completed").build()));

        mockMvc.perform(get("/api/external/classes").param("status", "ALL").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
        verify(externalApiService).fetchClasses(null);
    }

    @Test
    @DisplayName("GET /api/external/classes?status=completed - forwards a concrete status unchanged")
    void classes_ConcreteStatus_IsForwarded() throws Exception {
        when(externalApiService.fetchClasses("completed")).thenReturn(List.of());

        mockMvc.perform(get("/api/external/classes").param("status", "completed").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk());
        verify(externalApiService).fetchClasses("completed");
    }

    @Test
    @DisplayName("GET /api/external/trainers?status=all - asks the master system for trainers of every status")
    void trainers_StatusAll_SendsNoStatusUpstream() throws Exception {
        when(externalApiService.fetchTrainers(null)).thenReturn(List.of());

        mockMvc.perform(get("/api/external/trainers").param("status", "all").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk());
        verify(externalApiService).fetchTrainers(null);
    }

    @Test
    @DisplayName("GET /api/external/classes/{id} - an unknown class is a 404, not an error page")
    void classById_Unknown_Returns404() throws Exception {
        when(externalApiService.fetchClassById(404L)).thenThrow(new ExternalApiException("not found", 404, "{}"));

        mockMvc.perform(get("/api/external/classes/404").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/external/classes - master system down is a 503; an upstream 403 never becomes our 403")
    void classes_UpstreamFailures() throws Exception {
        when(externalApiService.fetchClasses(any())).thenThrow(new ExternalApiException("down", new RuntimeException("refused")));
        mockMvc.perform(get("/api/external/classes").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isServiceUnavailable());

        reset(externalApiService);
        when(externalApiService.fetchClasses(any())).thenThrow(new ExternalApiException("forbidden", 403, "{}"));
        mockMvc.perform(get("/api/external/classes").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isBadGateway());
    }
}
