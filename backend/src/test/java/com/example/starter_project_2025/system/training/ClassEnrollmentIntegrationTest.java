package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static com.example.starter_project_2025.system.training.TraineeImportContract.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:class_enrollment_tests;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
@AutoConfigureMockMvc
class ClassEnrollmentIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired TrainingClassRepository classes;
    @Autowired ClassEnrollmentRepository enrollments;
    @Autowired ClassEnrollmentService service;
    @Autowired ClassReadinessService readiness;
    @Autowired RefreshTokenService tokens;
    @Autowired UserDetailsService users;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @MockBean ExternalApiService directory;
    TrainingClass item;
    String adminToken;

    @BeforeEach void setup() {
        enrollments.deleteAll(); classes.deleteAll();
        item = createClass("ENROLL_TEST", 2);
        when(directory.fetchAllTrainees()).thenReturn(List.of(profile(101, "SE999001", "Test Student One"),
            profile(102, "SE999002", "Test Student Two"), profile(103, "SE999003", "Test Student Three")));
        adminToken = tokenFor("admin@example.com");
    }
    private String tokenFor(String username) {
        return new org.springframework.transaction.support.TransactionTemplate(transactions).execute(tx -> {
            var user = users.loadUserByUsername(username);
            return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        });
    }
    private Map<String, Object> profile(int id, String code, String name) {
        return Map.of("id", id, "fptAccount", code, "fullName", name, "personalEmail", "test" + id + "@example.test",
            "nationalId", "999999999999", "dob", "2000-01-01", "gender", "Male", "status", "Active");
    }
    private TrainingClass createClass(String code, int size) {
        var c = new TrainingClass(); c.setCode(code); c.setName("Enrollment test"); c.setStatus("planning");
        c.setStartDate(LocalDate.of(2030, 1, 1)); c.setEndDate(LocalDate.of(2030, 9, 1)); c.setPlannedSize(size);
        return classes.saveAndFlush(c);
    }
    private Row row(int number) { return new Row(number + 1, "SE99900" + number, "Test Student " + switch (number) { case 1 -> "One"; case 2 -> "Two"; default -> "Three"; }, null, null, null, null); }
    private org.springframework.test.web.servlet.ResultActions postRows(String action, Object rows) throws Exception {
        return mvc.perform(post("/api/classes/" + item.getId() + "/trainees/" + action).header("Authorization", "Bearer " + adminToken)
            .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(rows)));
    }

    @Test void previewDoesNotWriteAndConfirmImportsRealMembershipsWithoutChangingProfilesOrCapacity() throws Exception {
        postRows("preview", List.of(row(1), row(2))).andExpect(status().isOk()).andExpect(jsonPath("$.canImport").value(true));
        assertEquals(0, enrollments.count());
        postRows("import", List.of(row(1), row(2))).andExpect(status().isOk()).andExpect(jsonPath("$.importedCount").value(2))
            .andExpect(jsonPath("$.enrolledTrainees").value(2));
        assertEquals(2, enrollments.count()); assertEquals(2, classes.findById(item.getId()).orElseThrow().getPlannedSize());
        assertEquals(ClassReadinessService.State.READY, readiness.get(item.getId()).checks().stream().filter(c -> c.key().equals("enrollment")).findFirst().orElseThrow().status());
        mvc.perform(get("/api/classes/" + item.getId() + "/trainees").header("Authorization", "Bearer " + adminToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(101)).andExpect(jsonPath("$[0].fptAccount").value("SE999001"));
        verify(directory, never()).addTraineeToClass(anyLong(), any());
    }
    @Test void missingRequiredFieldsAreRowSpecificAndAtomic() throws Exception {
        var invalid = new Row(9, "", "", null, null, null, null);
        postRows("import", List.of(row(1), invalid)).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors['rows[9].studentId']").isArray()).andExpect(jsonPath("$.errors['rows[9].fullName']").isArray());
        assertEquals(0, enrollments.count());
    }
    @Test void duplicateIdsWithinFileAndWithinClassAreRejected() throws Exception {
        var duplicate = new Row(5, "se999001", "Test Student One", null, null, null, null);
        postRows("preview", List.of(row(1), duplicate)).andExpect(status().isOk()).andExpect(jsonPath("$.duplicateRows").value(2)).andExpect(jsonPath("$.canImport").value(false));
        postRows("import", List.of(row(1))).andExpect(status().isOk());
        postRows("import", List.of(duplicate)).andExpect(status().isBadRequest());
        assertEquals(1, enrollments.count());
    }
    @Test void capacityIsCheckedDuringPreviewAndAgainAtConfirm() throws Exception {
        postRows("preview", List.of(row(1), row(2))).andExpect(status().isOk()).andExpect(jsonPath("$.canImport").value(true));
        service.importRows(item.getId(), List.of(row(3)), true);
        postRows("import", List.of(row(1), row(2))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors['rows[2].capacity']").isArray());
        assertEquals(1, enrollments.count());
    }
    @Test void oversizeFileRowsAreAllRejectedWithoutPartialImport() throws Exception {
        postRows("import", List.of(row(1), row(2), row(3))).andExpect(status().isBadRequest());
        assertEquals(0, enrollments.count());
    }
    @Test void validatesOptionalValuesWithoutReturningPersonalDataInErrors() throws Exception {
        var invalid = new Row(8, "SE999001", "Test Student One", "not-an-email", "secret-value", "2030-02-30", "Unexpected");
        var response = postRows("preview", List.of(invalid)).andExpect(status().isOk()).andExpect(jsonPath("$.invalidRows").value(1))
            .andExpect(jsonPath("$.rows[0].errors.dob").isArray()).andReturn().getResponse().getContentAsString();
        assertFalse(response.contains("secret-value")); assertFalse(response.contains("not-an-email"));
    }
    @Test void invalidAndInactiveStudentsAreNeverCreated() throws Exception {
        postRows("import", List.of(new Row(2, "", "Empty Student ID", null, null, null, null))).andExpect(status().isBadRequest());
        when(directory.fetchAllTrainees()).thenReturn(List.of(Map.of("id", 101, "fptAccount", "SE999001", "fullName", "Test Student One", "status", "Inactive")));
        postRows("import", List.of(row(1))).andExpect(status().isBadRequest());
        assertEquals(0, enrollments.count());
    }
    @Test void unavailableOrSampleDirectoryFallsBackResiliently() throws Exception {
        when(directory.fetchAllTrainees()).thenThrow(new ExternalApiException("Directory unavailable", 503, null));
        postRows("preview", List.of(row(1))).andExpect(status().isOk());
        when(directory.isSampleData()).thenReturn(true);
        postRows("import", List.of(row(1))).andExpect(status().isOk());
        assertEquals(1, enrollments.count());
    }
    @Test void removeOnlyUnlinksThisClassAndAllowsReEnrollmentWithoutDuplicateRows() {
        var other = createClass("ENROLL_OTHER", 2);
        service.importRows(item.getId(), List.of(row(1)), true); service.importRows(other.getId(), List.of(row(1)), true);
        service.batch(item.getId(), new Batch(List.of(), List.of(), List.of(101L)), true);
        assertEquals(0, enrollments.occupiedSeats(item.getId())); assertEquals(1, enrollments.occupiedSeats(other.getId()));
        service.importRows(item.getId(), List.of(row(1)), true);
        assertEquals(2, enrollments.count()); assertEquals(1, enrollments.occupiedSeats(item.getId()));
    }
    @Test void invalidBatchRollsBackStagedRemoval() {
        service.importRows(item.getId(), List.of(row(1)), true);
        var invalid = new Row(4, "", "Invalid Student Without ID", null, null, null, null);
        assertThrows(RuntimeException.class, () -> service.batch(item.getId(), new Batch(List.of(invalid), List.of(), List.of(101L)), true));
        assertEquals(1, enrollments.occupiedSeats(item.getId()));
    }
    @Test void classStatusAndSoftDeletionPreventImport() throws Exception {
        item.setStatus("closed"); classes.saveAndFlush(item); postRows("import", List.of(row(1))).andExpect(status().isConflict());
        item.setIsActive(false); classes.saveAndFlush(item); postRows("import", List.of(row(1))).andExpect(status().isNotFound());
    }
    @Test void nationalIdIsSuppressedWithoutProfilePermission() {
        service.importRows(item.getId(), List.of(row(1)), true);
        assertNull(service.list(item.getId(), false).getFirst().nationalId());
        var supplied = new Row(3, "SE999002", "Test Student Two", null, "999999999999", null, null);
        assertFalse(service.preview(item.getId(), List.of(supplied), false).canImport());
    }
    @Test void concurrentImportsSerializeCapacityChecks() throws Exception {
        item.setPlannedSize(1); classes.saveAndFlush(item);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var jobs = List.of(1, 2).stream().map(number -> executor.submit(() -> {
                start.await();
                try { service.importRows(item.getId(), List.of(row(number)), true); return true; }
                catch (com.example.starter_project_2025.exception.BusinessValidationException ex) { return false; }
            })).toList();
            start.countDown(); int saved = 0;
            for (var job : jobs) if (job.get(20, TimeUnit.SECONDS)) saved++;
            assertEquals(1, saved); assertEquals(1, enrollments.occupiedSeats(item.getId()));
        }
    }
    @Test void endpointsRequireAuthenticationAndEnrollmentPermissions() throws Exception {
        String path = "/api/classes/" + item.getId() + "/trainees/import";
        mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(List.of(row(1)))))
            .andExpect(status().isUnauthorized());
        var token = tokenFor("student@example.com");
        mvc.perform(post(path).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(List.of(row(1)))))
            .andExpect(status().isForbidden());
        postRows("import", List.of(row(1))).andExpect(status().isOk());
    }
    @Test void batchEndpointUpdatesOnlyMembershipAndCannotRemoveAnotherClassesEnrollment() throws Exception {
        service.importRows(item.getId(), List.of(row(1)), true);
        var other = createClass("BATCH_OTHER", 2);
        service.importRows(other.getId(), List.of(row(2)), true);
        String path = "/api/classes/" + item.getId() + "/trainees/batch";
        var change = new Batch(List.of(), List.of(new StatusUpdate(101L, "Inactive")), List.of());
        mvc.perform(put(path).header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(change)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.trainees[0].status").value("Inactive"))
            .andExpect(jsonPath("$.trainees[0].fullName").value("Test Student One"));
        var invalid = new Batch(List.of(), List.of(), List.of(102L));
        mvc.perform(put(path).header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(invalid)))
            .andExpect(status().isConflict());
        assertEquals(1, enrollments.occupiedSeats(other.getId()));
    }
    @Test void loggingRepresentationsNeverContainPersonalValues() {
        var input = new Row(2, "SE999001", "Private Name", "private@example.test", "999999999999", "2000-01-01", "Male");
        var view = new TraineeView(1L, "SE999001", "SE999001", "Private Name", "private@example.test", "999999999999", "2000-01-01", "Male", "Active");
        assertFalse(input.toString().contains("Private Name")); assertFalse(input.toString().contains("999999999999"));
        assertFalse(view.toString().contains("private@example.test")); assertFalse(view.toString().contains("2000-01-01"));
    }
    @Test void strictAllOrNothingRollsBackWhenSingleRowHasDuplicateEmailOrInvalidStatus() throws Exception {
        var valid = new Row(2, "SE999001", "Valid Student", "student1@example.com", null, "2001-01-01", "Male", "Active");
        var invalidStatus = new Row(3, "SE999002", "Invalid Status Student", "student2@example.com", null, "2001-02-02", "Female", "BAD_STATUS");
        postRows("import", List.of(valid, invalidStatus)).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors['rows[3].status']").isArray());
        assertEquals(0, enrollments.count());

        var duplicateEmailInFile = new Row(4, "SE999002", "Duplicate Email Student", "student1@example.com", null, "2001-02-02", "Female", "Active");
        postRows("import", List.of(valid, duplicateEmailInFile)).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors['rows[2].personalEmail']").isArray())
            .andExpect(jsonPath("$.errors['rows[4].personalEmail']").isArray());
        assertEquals(0, enrollments.count());
    }
    @Test void importPreservesAllSixFieldsAndStatusAndPreventsDuplicateEmailAgainstDb() throws Exception {
        var r1 = new Row(2, "SE999001", "First Student", "student1@example.com", null, "2001-01-01", "Male", "Inactive");
        var r2 = new Row(3, "SE999002", "Second Student", "student2@example.com", null, "2001-02-02", "Female", "Dropped");
        postRows("import", List.of(r1, r2)).andExpect(status().isOk());
        assertEquals(2, enrollments.count());
        var list = service.list(item.getId(), true);
        assertEquals("Inactive", list.stream().filter(t -> t.code().equals("SE999001")).findFirst().orElseThrow().status());
        assertEquals("Dropped", list.stream().filter(t -> t.code().equals("SE999002")).findFirst().orElseThrow().status());

        // Now attempt to import a new trainee with the same email as student1@example.com
        var otherClass = createClass("OTHER_CLASS", 2);
        var conflictingEmail = new Row(2, "SE999003", "Third Student", "student1@example.com", null, "2001-03-03", "Male", "Active");
        mvc.perform(post("/api/classes/" + otherClass.getId() + "/trainees/import").header("Authorization", "Bearer " + adminToken)
            .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(List.of(conflictingEmail))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors['rows[2].personalEmail']").isArray());
        assertEquals(0, enrollments.occupiedSeats(otherClass.getId()));
    }
    @Test void fractionalMasterIdentityIsIgnoredSafely() throws Exception {
        when(directory.fetchAllTrainees()).thenReturn(List.of(Map.of("id", 101.5, "fptAccount", "SE999001", "fullName", "Test Student One", "status", "Active")));
        postRows("import", List.of(row(1))).andExpect(status().isOk());
        assertEquals(1, enrollments.count());
    }
}
