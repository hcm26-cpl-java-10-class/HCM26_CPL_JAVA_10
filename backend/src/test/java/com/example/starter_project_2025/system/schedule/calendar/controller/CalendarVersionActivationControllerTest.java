package com.example.starter_project_2025.system.schedule.calendar.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarVersionResponse;
import com.example.starter_project_2025.system.schedule.calendar.exception.CalendarActivationConflictException;
import com.example.starter_project_2025.system.schedule.calendar.service.CalendarVersionService;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictDTO;
import com.example.starter_project_2025.system.schedule.exception.SessionExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(CalendarVersionActivationControllerTest.TestConfig.class)
class CalendarVersionActivationControllerTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private FilterChainProxy springSecurityFilterChain;

    @Autowired
    private CalendarVersionService calendarVersionService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        reset(calendarVersionService);
        SecurityContextHolder.clearContext();
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(springSecurityFilterChain)
                .build();
    }

    @Test
    void shouldActivateVersionWithUpdatePermission() throws Exception {
        CalendarVersionResponse response = CalendarVersionResponse.builder()
                .calendarId(10L)
                .versionNumber(2)
                .status(CalendarVersionStatus.ACTIVE)
                .activatedBy(7L)
                .build();
        response.setId(20L);
        when(calendarVersionService.activateVersion(10L, 20L, 7L))
                .thenReturn(response);

        mockMvc.perform(post("/api/calendars/10/versions/20/activate")
                        .with(request -> authenticatedRequest(
                                request,
                                userPrincipal(7L, "CALENDARVERSION_UPDATE")
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(20))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.activatedBy").value(7));

        verify(calendarVersionService).activateVersion(10L, 20L, 7L);
    }

    @Test
    void shouldReturnConflictDetailsWhenActivationIsBlocked() throws Exception {
        ConflictCheckResult conflictResult = ConflictCheckResult.builder()
                .calendarVersionId(20L)
                .hasConflict(true)
                .conflicts(List.of(new ConflictDTO()))
                .build();
        when(calendarVersionService.activateVersion(10L, 20L, 7L))
                .thenThrow(new CalendarActivationConflictException(conflictResult));

        mockMvc.perform(post("/api/calendars/10/versions/20/activate")
                        .with(request -> authenticatedRequest(
                                request,
                                userPrincipal(7L, "CALENDARVERSION_UPDATE")
                        )))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CALENDAR_ACTIVATION_CONFLICT"))
                .andExpect(jsonPath("$.conflictCheck.calendarVersionId").value(20))
                .andExpect(jsonPath("$.conflictCheck.hasConflict").value(true));
    }

    @Test
    void shouldReturn403WithoutUpdatePermission() throws Exception {
        mockMvc.perform(post("/api/calendars/10/versions/20/activate")
                        .with(request -> authenticatedRequest(
                                request,
                                userPrincipal(7L, "CALENDARVERSION_READ")
                        )))
                .andExpect(status().isForbidden());

        verifyNoInteractions(calendarVersionService);
    }

    @Test
    void shouldReturn401WithoutAuthentication() throws Exception {
        mockMvc.perform(post("/api/calendars/10/versions/20/activate"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(calendarVersionService);
    }

    private UserPrincipal userPrincipal(Long userId, String authority) {
        User user = User.builder()
                .id(userId)
                .email("operator@example.com")
                .passwordHash("unused")
                .firstName("Schedule")
                .lastName("Operator")
                .isActive(true)
                .build();
        return new UserPrincipal(
                user,
                List.of(new SimpleGrantedAuthority(authority))
        );
    }

    private MockHttpServletRequest authenticatedRequest(
            MockHttpServletRequest request,
            UserPrincipal principal) {
        var securityContext = SecurityContextHolder.createEmptyContext();
        securityContext.setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        principal.getAuthorities()
                )
        );
        request.getSession().setAttribute(
                "SPRING_SECURITY_CONTEXT",
                securityContext
        );
        return request;
    }

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @EnableMethodSecurity
    @Import({
            CalendarVersionController.class,
            SessionExceptionHandler.class
    })
    static class TestConfig {

        @Bean
        CalendarVersionService calendarVersionService() {
            return mock(CalendarVersionService.class);
        }

        @Bean
        SecurityFilterChain testSecurityFilterChain(
                HttpSecurity http) throws Exception {
            return http
                    .csrf(csrf -> csrf.disable())
                    .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
                    .exceptionHandling(errors -> errors
                            .authenticationEntryPoint((request, response, ex) ->
                                    response.setStatus(HttpStatus.UNAUTHORIZED.value()))
                            .accessDeniedHandler((request, response, ex) ->
                                    response.setStatus(HttpStatus.FORBIDDEN.value())))
                    .build();
        }
    }
}
