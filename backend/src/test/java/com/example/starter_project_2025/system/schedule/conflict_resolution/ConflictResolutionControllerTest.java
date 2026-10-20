package com.example.starter_project_2025.system.schedule.conflict_resolution;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.ConflictResolutionResponse;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(ConflictResolutionControllerTest.TestConfig.class)
class ConflictResolutionControllerTest {

    @Autowired
    WebApplicationContext context;

    @Autowired
    FilterChainProxy springSecurityFilterChain;

    @Autowired
    ConflictResolutionService conflictResolutionService;

    MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        reset(conflictResolutionService);
        SecurityContextHolder.clearContext();
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(springSecurityFilterChain)
                .build();
    }

    @Test
    void requesterCanCreateResolutionAndActorComesFromAuthentication() throws Exception {
        ConflictResolutionResponse response = ConflictResolutionResponse.builder()
                .id(55L)
                .calendarVersionId(20L)
                .sessionId(101L)
                .conflictingSessionId(205L)
                .reasonCode(ConflictResolutionReason.SHARED_CLASS_SESSION)
                .status(ConflictResolutionStatus.PENDING)
                .build();
        when(conflictResolutionService.create(any(), any(), any())).thenReturn(response);

        mockMvc.perform(post("/api/calendar-versions/20/conflict-resolutions")
                        .contentType("application/json")
                        .content("""
                                {
                                  "sessionId": 101,
                                  "conflictingSessionId": 205,
                                  "reasonCode": "SHARED_CLASS_SESSION",
                                  "justification": "Joint workshop",
                                  "referenceCode": "WS-001"
                                }
                                """)
                        .with(request -> authenticatedRequest(
                                request,
                                userPrincipal(7L, "SCHEDULE_CONFLICT_RESOLUTION_REQUEST")
                        )))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(55))
                .andExpect(jsonPath("$.status").value("PENDING"));

        verify(conflictResolutionService).create(any(), any(), org.mockito.ArgumentMatchers.eq(7L));
    }

    @Test
    void approverCanApproveAndActorComesFromAuthentication() throws Exception {
        ConflictResolutionResponse response = ConflictResolutionResponse.builder()
                .id(55L)
                .calendarVersionId(20L)
                .status(ConflictResolutionStatus.APPROVED)
                .approvedBy(8L)
                .build();
        when(conflictResolutionService.approve(20L, 55L, 8L)).thenReturn(response);

        mockMvc.perform(post("/api/calendar-versions/20/conflict-resolutions/55/approve")
                        .with(request -> authenticatedRequest(
                                request,
                                userPrincipal(8L, "SCHEDULE_CONFLICT_RESOLUTION_APPROVE")
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.approvedBy").value(8));

        verify(conflictResolutionService).approve(20L, 55L, 8L);
    }

    @Test
    void createIsForbiddenWithoutRequestPermission() throws Exception {
        mockMvc.perform(post("/api/calendar-versions/20/conflict-resolutions")
                        .contentType("application/json")
                        .content("""
                                {
                                  "sessionId": 101,
                                  "conflictingSessionId": 205,
                                  "reasonCode": "SHARED_CLASS_SESSION",
                                  "justification": "Joint workshop",
                                  "referenceCode": "WS-001"
                                }
                                """)
                        .with(request -> authenticatedRequest(
                                request,
                                userPrincipal(7L, "SCHEDULE_CONFLICT_RESOLUTION_READ")
                        )))
                .andExpect(status().isForbidden());

        verifyNoInteractions(conflictResolutionService);
    }

    @Test
    void createRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/calendar-versions/20/conflict-resolutions")
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(conflictResolutionService);
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
        return new UserPrincipal(user, List.of(new SimpleGrantedAuthority(authority)));
    }

    private MockHttpServletRequest authenticatedRequest(
            MockHttpServletRequest request,
            UserPrincipal principal
    ) {
        var securityContext = SecurityContextHolder.createEmptyContext();
        securityContext.setAuthentication(new UsernamePasswordAuthenticationToken(
                principal,
                null,
                principal.getAuthorities()
        ));
        request.getSession().setAttribute("SPRING_SECURITY_CONTEXT", securityContext);
        return request;
    }

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @EnableMethodSecurity
    @Import(ConflictResolutionController.class)
    static class TestConfig {

        @Bean
        ConflictResolutionService conflictResolutionService() {
            return mock(ConflictResolutionService.class);
        }

        @Bean
        SecurityFilterChain testSecurityFilterChain(HttpSecurity http) throws Exception {
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
