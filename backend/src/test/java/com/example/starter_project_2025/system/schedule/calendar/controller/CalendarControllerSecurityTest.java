package com.example.starter_project_2025.system.schedule.calendar.controller;

import com.example.starter_project_2025.exception.GlobalExceptionHandler;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarResponse;
import com.example.starter_project_2025.system.schedule.calendar.service.CalendarService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitWebConfig(CalendarControllerSecurityTest.TestConfig.class)
class CalendarControllerSecurityTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private FilterChainProxy springSecurityFilterChain;

    @Autowired
    private CalendarService calendarService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        reset(calendarService);
        SecurityContextHolder.clearContext();

        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(springSecurityFilterChain)
                .build();
    }

    @Test
    void shouldReturn201WithCreatePermission() throws Exception {
        when(calendarService.createCalendar(10L))
                .thenReturn(CalendarResponse.builder()
                        .id(100L)
                        .classId(10L)
                        .lastIssuedVersionNumber(0)
                        .build());

        mockMvc.perform(post("/api/classes/10/calendar")
                        .with(request -> {
                            var securityContext =
                                    SecurityContextHolder.createEmptyContext();

                            securityContext.setAuthentication(
                                    new UsernamePasswordAuthenticationToken(
                                            "test-admin",
                                            null,
                                            List.of(new SimpleGrantedAuthority(
                                                    "CALENDAR_CREATE"))
                                    )
                            );

                            request.getSession().setAttribute(
                                    "SPRING_SECURITY_CONTEXT",
                                    securityContext
                            );
                            return request;
                        }))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(100))
                .andExpect(jsonPath("$.classId").value(10));

        verify(calendarService).createCalendar(10L);
    }

    @Test
    void shouldReturn403WithoutCreatePermission() throws Exception {
        mockMvc.perform(post("/api/classes/10/calendar")
                        .with(request -> {
                            var securityContext =
                                    SecurityContextHolder.createEmptyContext();

                            securityContext.setAuthentication(
                                    new UsernamePasswordAuthenticationToken(
                                            "test-student",
                                            null,
                                            List.of(new SimpleGrantedAuthority(
                                                    "CALENDAR_READ"))
                                    )
                            );

                            request.getSession().setAttribute(
                                    "SPRING_SECURITY_CONTEXT",
                                    securityContext
                            );
                            return request;
                        }))
                .andExpect(status().isForbidden());

        verifyNoInteractions(calendarService);
    }

    @Test
    void shouldReturn401WithoutAuthentication() throws Exception {
        mockMvc.perform(post("/api/classes/10/calendar"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(calendarService);
    }

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @EnableMethodSecurity
    @Import({
            CalendarController.class,
            GlobalExceptionHandler.class
    })
    static class TestConfig {

        @Bean
        CalendarService calendarService() {
            return mock(CalendarService.class);
        }

        @Bean
        SecurityFilterChain testSecurityFilterChain(
                HttpSecurity http) throws Exception {

            return http
                    .csrf(csrf -> csrf.disable())
                    .authorizeHttpRequests(auth ->
                            auth.anyRequest().authenticated())
                    .exceptionHandling(errors -> errors
                            .authenticationEntryPoint((request, response, ex) ->
                                    response.setStatus(
                                            HttpStatus.UNAUTHORIZED.value()))
                            .accessDeniedHandler((request, response, ex) ->
                                    response.setStatus(
                                            HttpStatus.FORBIDDEN.value())))
                    .build();
        }
    }
}