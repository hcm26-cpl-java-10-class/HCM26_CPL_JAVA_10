package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.ScheduleCandidate;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.*;
import jakarta.persistence.EntityManager;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"local", "schedule-demo"})
@Transactional
class TeachingAssignmentSlotsIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired ClassTrainingProgramRepository programs;
    @Autowired SessionRepository sessions;
    @Autowired TeachingAssignmentSessionGuard guard;
    @Autowired EntityManager entities;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    private String bearer;
    private List<Long> curriculum;
    private LocalDate day;

    @BeforeEach void setup() throws Exception {
        day = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(2);
        curriculum = new org.springframework.transaction.support.TransactionTemplate(transactions).execute(tx ->
                programs.findByClassId(1L).orElseThrow().getProgram().getSubjects().stream().map(ProgramSubject::getId).sorted().toList());
        var login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", "admin@example.com", "password", "password123"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        bearer = "Bearer " + json.readTree(login).get("accessToken").asText();
    }

    @Test void persistsMultipleSlotsIncludingAdjacentHoursAndAnotherDate() throws Exception {
        long id = create(body(0, 1, List.of(slot(day, "08:00", "10:00"), slot(day, "10:00", "12:00"), slot(day.plusDays(1), "08:00", "10:00"))));
        entities.flush(); entities.clear();
        mvc.perform(get("/api/teaching-assignments/" + id).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.teachingSlots.length()").value(3))
                .andExpect(jsonPath("$.teachingSlots[0].date").value(day.toString()))
                .andExpect(jsonPath("$.teachingSlots[1].startTime").value("10:00:00"));
    }

    @Test void sameTrainerCanTeachDifferentSubjectsInAdjacentSlotsButNotOverlappingOnes() throws Exception {
        create(body(0, 1, List.of(slot(day, "08:00", "10:00"))));
        submit(body(1, 1, List.of(slot(day, "09:00", "11:00"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.teachingSlots").isArray());
        create(body(1, 1, List.of(slot(day, "10:00", "12:00"))));
        assertThat(assignments.count()).isEqualTo(2);
    }

    @Test void differentDatesAndDifferentTrainersDoNotConflict() throws Exception {
        create(body(0, 1, List.of(slot(day, "08:00", "10:00"))));
        create(body(1, 1, List.of(slot(day.plusDays(1), "08:00", "10:00"))));
        create(body(1, 2, List.of(slot(day, "08:00", "10:00"))));
        assertThat(assignments.count()).isEqualTo(3);
    }

    @Test void rejectsMissingMalformedReversedAndInternallyOverlappingSlotsBeforeSaving() throws Exception {
        for (var slots : List.of(List.of(slot(day, "08:00", "08:00")), List.of(slot(day, "10:00", "08:00")),
                List.of(slot(day, "23:00", "01:00")), List.of(slot(day, "08:00:30", "10:00")),
                List.of(slot(day.minusDays(1), "08:00", "10:00")), List.of(slot(day.plusDays(31), "08:00", "10:00")),
                List.of(slot(day, "08:00", "10:00"), slot(day, "09:00", "11:00")), List.of(Map.of("date", day.toString(), "startTime", "08:00")))) {
            submit(body(0, 1, slots)).andExpect(status().isBadRequest());
        }
        var empty = body(0, 1, List.of()); submit(empty).andExpect(status().isBadRequest());
        assertThat(assignments.count()).isZero();
    }

    @Test void availabilityRequiresTheEntireSessionToFitInsideOneDatedSlot() throws Exception {
        create(body(0, 1, List.of(slot(day, "08:00", "10:00"), slot(day, "11:00", "12:00"))));
        for (var interval : List.of(List.of("08:00", "10:00", "1"), List.of("09:00", "11:30", "0"), List.of("07:59", "09:00", "0"))) {
            mvc.perform(get("/api/classes/1/teaching-assignments/available").header("Authorization", bearer)
                    .param("from", day + "T" + interval.get(0)).param("to", day + "T" + interval.get(1)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(Integer.parseInt(interval.get(2))));
        }
        mvc.perform(get("/api/classes/1/teaching-assignments/available").header("Authorization", bearer).param("date", day.plusDays(1).toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test void rejectsHalfHourOrShorterSlotsAndAcceptsThirtyOneMinutes() throws Exception {
        for (var times : List.of(List.of("09:00", "09:29"), List.of("09:00", "09:30"), List.of("08:50", "09:20"))) {
            submit(body(0, 1, List.of(slot(day, times.get(0), times.get(1)))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors['teachingSlots[0].endTime'][0]").value("Each teaching slot must be longer than 30 minutes."));
        }
        assertThat(assignments.count()).isZero();
        create(body(0, 1, List.of(slot(day, "08:50", "09:21"))));
    }

    @Test void linkedSessionBlocksRemovingItsSlotAndOmittedSlotsOnEditArePreserved() throws Exception {
        long id = create(body(0, 1, List.of(slot(day, "08:00", "10:00"))));
        var a = assignments.findById(id).orElseThrow();
        var booking = booking(id, "08:30", "09:30"); sessions.saveAndFlush(booking);
        var change = body(0, 1, List.of(slot(day, "10:00", "12:00"))); change.put("revision", a.getRevision());
        mvc.perform(post("/api/teaching-assignments/" + id + "/impact-preview").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(change)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.canSave").value(false))
                .andExpect(jsonPath("$.affectedSessionCount").value(1));
        mvc.perform(put("/api/teaching-assignments/" + id).header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(change)))
                .andExpect(status().isConflict());
        change.remove("teachingSlots");
        mvc.perform(put("/api/teaching-assignments/" + id).header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(change)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.teachingSlots.length()").value(1));
    }

    @Test void sessionGuardRejectsOutsideSlotsAndProtectsReservationsFromUnlinkedSessions() throws Exception {
        long id = create(body(0, 1, List.of(slot(day, "08:00", "10:00"))));
        guard.requireCompatible(candidate(id, "08:00", "10:00"));
        assertThatThrownBy(() -> guard.requireCompatible(candidate(id, "09:00", "11:00"))).isInstanceOf(BusinessValidationException.class);
        assertThatThrownBy(() -> guard.requireCompatible(candidate(null, "09:00", "11:00"))).isInstanceOf(BusinessValidationException.class);
        guard.requireCompatible(candidate(null, "10:00", "12:00"));
    }

    @Test void existingSessionAlsoPreventsReservingAnOverlappingTeachingSlot() throws Exception {
        sessions.saveAndFlush(booking(null, "09:00", "11:00"));
        submit(body(0, 1, List.of(slot(day, "08:00", "10:00")))).andExpect(status().isBadRequest());
        create(body(0, 1, List.of(slot(day, "11:00", "12:00"))));
    }

    @Test void endingReleasesFutureReservationsWhileKeepingDatedHistory() throws Exception {
        long id = create(body(0, 1, List.of(slot(day.plusDays(5), "08:00", "10:00"))));
        var revision = assignments.findById(id).orElseThrow().getRevision();
        mvc.perform(patch("/api/teaching-assignments/" + id + "/end").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("revision", revision, "effectiveTo", day.plusDays(1).toString()))))
                .andExpect(status().isOk());
        assertThat(assignments.existsTrainerSlotConflict(1L, null, day.plusDays(5), LocalTime.of(8, 0), LocalTime.of(10, 0))).isFalse();
        mvc.perform(get("/api/classes/1/teaching-assignments/available").header("Authorization", bearer).param("date", day.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test void availabilityDoesNotOfferLegacyAssignmentsDuringAnotherReservedSlot() throws Exception {
        long id = create(body(0, 1, List.of(slot(day, "08:00", "10:00"))));
        var legacy = body(1, 1, List.of()); legacy.remove("teachingSlots");
        create(legacy);
        mvc.perform(get("/api/classes/1/teaching-assignments/available").header("Authorization", bearer)
                .param("from", day + "T08:00").param("to", day + "T10:00"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(id));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentReservationsForTheSameTrainerCannotBothCommit() throws Exception {
        var gate = new java.util.concurrent.CountDownLatch(1);
        var ids = new ArrayList<Long>();
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var tasks = new ArrayList<java.util.concurrent.Future<org.springframework.mock.web.MockHttpServletResponse>>();
            for (int subject : List.of(0, 1)) tasks.add(pool.submit(() -> {
                gate.await(); return submit(body(subject, 1, List.of(slot(day, "14:00", "16:00")))).andReturn().getResponse();
            }));
            gate.countDown();
            var statuses = new ArrayList<Integer>();
            for (var task : tasks) {
                var response = task.get(30, java.util.concurrent.TimeUnit.SECONDS); statuses.add(response.getStatus());
                if (response.getStatus() == 201) ids.add(json.readTree(response.getContentAsString()).get("id").asLong());
            }
            assertThat(statuses).containsExactlyInAnyOrder(201, 400);
        } finally { gate.countDown(); ids.forEach(assignments::deleteById); }
    }

    private Map<String, Object> body(int subject, long trainer, List<? extends Map<String, String>> slots) {
        return new HashMap<>(Map.of("classId", 1, "programSubjectId", curriculum.get(subject), "trainerId", trainer,
                "role", trainer == 1 ? "MAIN" : "ASSISTANT", "effectiveFrom", day.toString(), "effectiveTo", day.plusDays(30).toString(), "teachingSlots", slots));
    }
    private Map<String, String> slot(LocalDate date, String from, String to) {
        return Map.of("date", date.toString(), "startTime", from, "endTime", to);
    }
    private ResultActions submit(Map<String, Object> body) throws Exception {
        return mvc.perform(post("/api/teaching-assignments").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }
    private long create(Map<String, Object> body) throws Exception {
        return json.readTree(submit(body).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
    }
    private Session booking(Long assignmentId, String from, String to) {
        var session = new Session(); session.setClassId(1L); session.setTrainerId(1L); session.setTeachingAssignmentId(assignmentId);
        session.setTopicId(programs.findByClassId(1L).orElseThrow().getProgram().getSubjects().get(0).getSubject().getId());
        session.setTitle("Existing teaching session"); session.setStartTime(day.atTime(LocalTime.parse(from))); session.setEndTime(day.atTime(LocalTime.parse(to)));
        session.setStatus(Session.SessionStatus.SCHEDULED); session.setIsActive(true); session.setMeetingUrl("https://example.com/lesson"); return session;
    }
    private ScheduleCandidate candidate(Long assignmentId, String from, String to) {
        return new ScheduleCandidate(null, 1L, null, 1L, assignmentId, null, null, "https://example.com/lesson", "Teaching slot test",
                day.atTime(LocalTime.parse(from)), day.atTime(LocalTime.parse(to)));
    }
}
