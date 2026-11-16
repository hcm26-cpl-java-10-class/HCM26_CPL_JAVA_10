package com.example.starter_project_2025.system.calendar;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionDTO;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "local"})
@TestPropertySource(properties = "app.seed.team-allocation.enabled=false")
@Transactional
class CalendarControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private UserDetailsService userDetailsService;

    private String adminToken;

    @BeforeEach
    void setUp() {
        UserDetails admin = userDetailsService.loadUserByUsername("admin@example.com");
        adminToken = refreshTokenService.generateAccessToken(
                new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
    }

    @Test
    void getCalendarSessions_filtersAndValidatesDateRange() throws Exception {
        mockMvc.perform(get("/api/calendar/sessions")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("from", "2026-10-01T00:00:00")
                        .param("to", "2026-10-05T23:59:59")
                        .param("classId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());

        mockMvc.perform(get("/api/calendar/sessions")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("from", "2026-10-10T00:00:00")
                        .param("to", "2026-10-01T00:00:00"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validateSchedule_detectsCrossClassTrainerAndRoomOverlap() throws Exception {
        sessionRepository.saveAndFlush(Session.builder()
                .classId(2L)
                .topicId(2L)
                .trainerId(3L)
                .title("[SPRING_BOOT] Existing Class 2 Session")
                .startTime(LocalDateTime.of(2028, 5, 10, 8, 0))
                .endTime(LocalDateTime.of(2028, 5, 10, 12, 0))
                .location("Room Lab 999")
                .status(Session.SessionStatus.SCHEDULED)
                .isActive(true)
                .build());

        var request = new CalendarValidateRequest(
                1L,
                LocalDate.of(2028, 5, 10),
                List.of(new CalendarValidateRequest.CandidateSession(
                        "cand-1",
                        "[JAVA_CORE] Conflicting Session",
                        1L,
                        3L,
                        "Room Lab 999",
                        LocalDateTime.of(2028, 5, 10, 9, 0),
                        LocalDateTime.of(2028, 5, 10, 11, 0)
                ))
        );

        mockMvc.perform(post("/api/calendar/validate")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.issues", hasSize(2)));
    }

    @Test
    void createBatchAndDeleteByClassId_validateConflictsAtomically() throws Exception {
        long testClassId = 999L;

        List<SessionDTO> validBatch = List.of(
                SessionDTO.builder()
                        .classId(testClassId).topicId(1L).trainerId(1L)
                        .title("[JAVA_CORE] Batch 1")
                        .startTime(LocalDateTime.of(2028, 6, 1, 8, 0))
                        .endTime(LocalDateTime.of(2028, 6, 1, 12, 0))
                        .location("Lab 201").build(),
                SessionDTO.builder()
                        .classId(testClassId).topicId(1L).trainerId(1L)
                        .title("[JAVA_CORE] Batch 2")
                        .startTime(LocalDateTime.of(2028, 6, 1, 13, 0))
                        .endTime(LocalDateTime.of(2028, 6, 1, 17, 0))
                        .location("Lab 201").build()
        );

        mockMvc.perform(post("/api/sessions/batch")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBatch)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));

        assertEquals(2, sessionRepository.findByClassId(testClassId).size());

        List<SessionDTO> conflictingBatch = List.of(
                SessionDTO.builder()
                        .classId(testClassId).topicId(1L).trainerId(1L)
                        .title("[JAVA_CORE] Overlap 1")
                        .startTime(LocalDateTime.of(2028, 6, 2, 8, 0))
                        .endTime(LocalDateTime.of(2028, 6, 2, 12, 0))
                        .location("Lab 201").build(),
                SessionDTO.builder()
                        .classId(testClassId).topicId(1L).trainerId(1L)
                        .title("[JAVA_CORE] Overlap 2")
                        .startTime(LocalDateTime.of(2028, 6, 2, 10, 0))
                        .endTime(LocalDateTime.of(2028, 6, 2, 13, 0))
                        .location("Lab 201").build()
        );

        mockMvc.perform(post("/api/sessions/batch")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(conflictingBatch)))
                .andExpect(status().isConflict());

        // Atomic rollback ensures Overlap 1 was not persisted either
        assertEquals(2, sessionRepository.findByClassId(testClassId).size());

        mockMvc.perform(delete("/api/sessions/class/" + testClassId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        assertEquals(0, sessionRepository.findByClassId(testClassId).size());
    }
}

