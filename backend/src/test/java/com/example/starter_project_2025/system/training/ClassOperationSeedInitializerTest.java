package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.init.ClassOperationDataInitializer;
import com.example.starter_project_2025.system.training.entity.ClassTopicMarkLockEntity;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:class_op_seed_tests;DB_CLOSE_DELAY=-1",
        "app.seed.training-operation.force-in-memory=true",
        "app.scheduling.enabled=false"
})
class ClassOperationSeedInitializerTest {

    @Autowired TrainingClassRepository trainingClassRepository;
    @Autowired ClassEnrollmentRepository enrollmentRepository;
    @Autowired ClassAttendanceRepository attendanceRepository;
    @Autowired ClassTopicMarkRepository topicMarkRepository;
    @Autowired ClassTopicMarkLockRepository topicMarkLockRepository;
    @Autowired ClassActivityEntityRepository activityRepository;
    @Autowired ClassOperationDatabaseService operationDatabaseService;
    @Autowired ClassOperationDataInitializer initializer;

    @Test
    void seedsBaselineClassesTraineesAndAttendanceOnceAndPreservesUserEdits() {
        List<TrainingClass> classes = trainingClassRepository.findAll();
        TrainingClass java01 = classes.stream()
                .filter(c -> "LOCAL_JAVA_01".equals(c.getCode()))
                .findFirst()
                .orElseThrow();
        TrainingClass java02 = classes.stream()
                .filter(c -> "LOCAL_JAVA_02".equals(c.getCode()))
                .findFirst()
                .orElseThrow();

        List<ClassEnrollment> class1Enrollments =
                enrollmentRepository.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(java01.getId());
        List<ClassEnrollment> class2Enrollments =
                enrollmentRepository.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(java02.getId());

        assertEquals(24, class1Enrollments.size());
        assertEquals("AI237193", class1Enrollments.get(0).getStudentId());
        assertEquals("Vũ Mai Trang", class1Enrollments.get(0).getFullName());
        assertEquals("SE726809", class1Enrollments.get(23).getStudentId());

        assertEquals(10, class2Enrollments.size());
        assertEquals("SE180101", class2Enrollments.get(0).getStudentId());
        assertEquals("SS180110", class2Enrollments.get(9).getStudentId());

        assertEquals(24, attendanceRepository.findByClassIdOrderByTraineeIdAsc(java01.getId()).size());
        assertEquals(10, attendanceRepository.findByClassIdOrderByTraineeIdAsc(java02.getId()).size());

        // Simulate user soft-deleting one trainee and changing another's status
        ClassEnrollment deleted = class1Enrollments.get(0);
        deleted.setIsActive(false);
        ClassEnrollment modified = class1Enrollments.get(1);
        modified.setStatus(ClassEnrollment.Status.INACTIVE);
        enrollmentRepository.saveAllAndFlush(List.of(deleted, modified));

        // Re-running initializer must never resurrect deleted rows or overwrite modified rows
        initializer.run();

        List<ClassEnrollment> afterRerun =
                enrollmentRepository.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(java01.getId());
        assertEquals(23, afterRerun.size());
        assertTrue(afterRerun.stream().noneMatch(e -> "AI237193".equals(e.getStudentId())));
        assertEquals(
                ClassEnrollment.Status.INACTIVE,
                afterRerun.stream()
                        .filter(e -> "IA506908".equals(e.getStudentId()))
                        .findFirst()
                        .orElseThrow()
                        .getStatus()
        );
    }

    @Test
    @SuppressWarnings("unchecked")
    void derivesDynamicGradebookSchemaFromTopicAssessmentsRecalculatesAndPersistsMarksInH2() {
        TrainingClass java01 = trainingClassRepository.findAll().stream()
                .filter(c -> "LOCAL_JAVA_01".equals(c.getCode()))
                .findFirst()
                .orElseThrow();

        Map<String, Object> initialMarks = operationDatabaseService.getClassTopicMarks(java01.getId());
        List<Map<String, Object>> topics = (List<Map<String, Object>>) initialMarks.get("topics");
        assertFalse(topics.isEmpty());
        String firstTopicCode = String.valueOf(topics.get(0).get("code"));
        String firstTopicTitle = String.valueOf(topics.get(0).get("title"));

        assertFalse(topicMarkRepository.findByClassIdAndTopicCodeOrderByTraineeIdAsc(java01.getId(), firstTopicCode).isEmpty());

        // Customize topic assessments to a 4-column schema (15% + 25% + 20% + 40% = 100%)
        List<Map<String, Object>> customAssessments = List.of(
                new LinkedHashMap<>(Map.of("id", 9001, "name", "Quiz", "weightedNumber", 15, "quantity", 2, "changeStatus", "waiting")),
                new LinkedHashMap<>(Map.of("id", 9002, "name", "Lab Practice", "weightedNumber", 25, "quantity", 3, "changeStatus", "waiting")),
                new LinkedHashMap<>(Map.of("id", 9003, "name", "Midterm", "weightedNumber", 20, "quantity", 1, "changeStatus", "waiting")),
                new LinkedHashMap<>(Map.of("id", 9004, "name", "Final", "weightedNumber", 40, "quantity", 1, "changeStatus", "waiting"))
        );
        operationDatabaseService.saveTopicAssessments(java01.getId(), Map.of(
                "action", "confirm",
                "topics", List.of(new LinkedHashMap<>(Map.of("title", firstTopicTitle, "assessments", customAssessments)))
        ));

        Map<String, Object> updatedSchemaPayload = operationDatabaseService.getClassTopicMarks(java01.getId());
        List<Map<String, Object>> updatedTopics = (List<Map<String, Object>>) updatedSchemaPayload.get("topics");
        List<Map<String, Object>> cols = (List<Map<String, Object>>) updatedTopics.get(0).get("columns");
        assertEquals(4, cols.size());
        assertEquals("assessment_9001", cols.get(0).get("key"));
        assertEquals("Lab Practice", cols.get(1).get("name"));

        // Save valid scores for trainee 1001 & verify weighted GPA = 8*0.15 + 9*0.25 + 7*0.20 + 10*0.40 = 8.85 -> 8.9
        int activitiesBefore = activityRepository.findByTrainingClass_IdOrderByIdDesc(java01.getId()).size();
        Map<String, Object> saved = operationDatabaseService.saveClassTopicMarks(java01.getId(), Map.of(
                "topicCode", firstTopicCode,
                "source", "inline_edit",
                "recordsByTraineeId", Map.of(
                        "1001", Map.of(
                                "componentScores", Map.of(
                                        "assessment_9001", 8.0,
                                        "assessment_9002", 9.0,
                                        "assessment_9003", 7.0,
                                        "assessment_9004", 10.0
                                )
                        )
                )
        ));

        List<Map<String, Object>> savedTopics = (List<Map<String, Object>>) saved.get("topics");
        Map<String, Object> recs = (Map<String, Object>) savedTopics.get(0).get("recordsByTraineeId");
        Map<String, Object> rec1001 = (Map<String, Object>) recs.get("1001");
        assertEquals(8.9, ((Number) rec1001.get("totalGpa")).doubleValue(), 0.01);
        assertEquals(Boolean.TRUE, rec1001.get("passed"));
        assertEquals(activitiesBefore + 1, activityRepository.findByTrainingClass_IdOrderByIdDesc(java01.getId()).size());

        // Reject out-of-range score > 10.0
        assertThrows(BadRequestException.class, () -> operationDatabaseService.saveClassTopicMarks(java01.getId(), Map.of(
                "topicCode", firstTopicCode,
                "recordsByTraineeId", Map.of(
                        "1001", Map.of(
                                "componentScores", Map.of(
                                        "assessment_9001", 11.5,
                                        "assessment_9002", 9.0,
                                        "assessment_9003", 7.0,
                                        "assessment_9004", 10.0
                                )
                        )
                )
        )));
    }

    @Test
    @SuppressWarnings("unchecked")
    void locksTopicMarksWith4DigitPinEnforcesAntiTamperingAndProgressiveCooldownLadder() {
        TrainingClass java01 = trainingClassRepository.findAll().stream()
                .filter(c -> "LOCAL_JAVA_01".equals(c.getCode()))
                .findFirst()
                .orElseThrow();

        Map<String, Object> gradebook = operationDatabaseService.getClassTopicMarks(java01.getId());
        List<Map<String, Object>> topics = (List<Map<String, Object>>) gradebook.get("topics");
        Map<String, Object> targetTopic = topics.get(topics.size() - 1);
        String topicCode = String.valueOf(targetTopic.get("code"));
        List<Map<String, Object>> cols = (List<Map<String, Object>>) targetTopic.get("columns");
        Map<String, Object> sampleScores = new LinkedHashMap<>();
        for (Map<String, Object> col : cols) {
            sampleScores.put(String.valueOf(col.get("key")), 8.5);
        }

        // 1. Lock topic marks -> issues a 4-digit PIN & stores BCrypt hash (never plaintext)
        Map<String, Object> lockRes = operationDatabaseService.lockClassTopicMarks(
                java01.getId(), Map.of("topicCode", topicCode));
        assertEquals(Boolean.TRUE, lockRes.get("locked"));
        String issuedPin = String.valueOf(lockRes.get("pin"));
        assertTrue(issuedPin.matches("^\\d{4}$"));

        ClassTopicMarkLockEntity storedLock = topicMarkLockRepository
                .findByClassIdAndTopicCode(java01.getId(), topicCode)
                .orElseThrow();
        assertTrue(Boolean.TRUE.equals(storedLock.getLocked()));
        assertNotEquals(issuedPin, storedLock.getPinHash());

        // 2. Saving marks while locked must fail with 409 ConflictException
        assertThrows(ConflictException.class, () -> operationDatabaseService.saveClassTopicMarks(
                java01.getId(),
                Map.of(
                        "topicCode", topicCode,
                        "recordsByTraineeId", Map.of("1001", Map.of("componentScores", sampleScores))
                )
        ));

        String wrongPin = "0000".equals(issuedPin) ? "9999" : "0000";

        // 3. Wrong PIN #1 & #2 -> 400 with remaining attempts 2 -> 1
        Map<String, Object> fail1 = operationDatabaseService.unlockClassTopicMarks(
                java01.getId(), Map.of("topicCode", topicCode, "pin", wrongPin));
        assertEquals(false, fail1.get("unlocked"));
        assertEquals(400, fail1.get("httpStatus"));
        assertEquals(2, ((Map<String, Object>) fail1.get("lock")).get("remainingAttempts"));

        Map<String, Object> fail2 = operationDatabaseService.unlockClassTopicMarks(
                java01.getId(), Map.of("topicCode", topicCode, "pin", wrongPin));
        assertEquals(400, fail2.get("httpStatus"));
        assertEquals(1, ((Map<String, Object>) fail2.get("lock")).get("remainingAttempts"));

        // 4. Wrong PIN #3 -> Tier 1 lockout (1 minute) with 429
        Map<String, Object> fail3 = operationDatabaseService.unlockClassTopicMarks(
                java01.getId(), Map.of("topicCode", topicCode, "pin", wrongPin));
        assertEquals(429, fail3.get("httpStatus"));
        assertEquals(Boolean.TRUE, fail3.get("cooldownActive"));
        assertEquals(1, fail3.get("penaltyMinutes"));
        assertEquals(1, ((Map<String, Object>) fail3.get("lock")).get("lockoutTier"));

        // Even the correct PIN is rejected while cooldown is active
        Map<String, Object> duringCooldown = operationDatabaseService.unlockClassTopicMarks(
                java01.getId(), Map.of("topicCode", topicCode, "pin", issuedPin));
        assertEquals(false, duringCooldown.get("unlocked"));
        assertEquals(429, duringCooldown.get("httpStatus"));

        // 5. Simulate cooldown expiry -> 3 more failures escalate to Tier 2 (5 minutes) -> Tier 3 (15 minutes)
        ClassTopicMarkLockEntity lockRow = topicMarkLockRepository.findByClassIdAndTopicCode(java01.getId(), topicCode).orElseThrow();
        lockRow.setCooldownUntil(Instant.now().minusSeconds(1));
        topicMarkLockRepository.saveAndFlush(lockRow);

        operationDatabaseService.unlockClassTopicMarks(java01.getId(), Map.of("topicCode", topicCode, "pin", wrongPin));
        operationDatabaseService.unlockClassTopicMarks(java01.getId(), Map.of("topicCode", topicCode, "pin", wrongPin));
        Map<String, Object> tier2Lockout = operationDatabaseService.unlockClassTopicMarks(
                java01.getId(), Map.of("topicCode", topicCode, "pin", wrongPin));
        assertEquals(429, tier2Lockout.get("httpStatus"));
        assertEquals(5, tier2Lockout.get("penaltyMinutes"));
        assertEquals(2, ((Map<String, Object>) tier2Lockout.get("lock")).get("lockoutTier"));

        lockRow = topicMarkLockRepository.findByClassIdAndTopicCode(java01.getId(), topicCode).orElseThrow();
        lockRow.setCooldownUntil(Instant.now().minusSeconds(1));
        topicMarkLockRepository.saveAndFlush(lockRow);

        operationDatabaseService.unlockClassTopicMarks(java01.getId(), Map.of("topicCode", topicCode, "pin", wrongPin));
        operationDatabaseService.unlockClassTopicMarks(java01.getId(), Map.of("topicCode", topicCode, "pin", wrongPin));
        Map<String, Object> tier3Lockout = operationDatabaseService.unlockClassTopicMarks(
                java01.getId(), Map.of("topicCode", topicCode, "pin", wrongPin));
        assertEquals(429, tier3Lockout.get("httpStatus"));
        assertEquals(15, tier3Lockout.get("penaltyMinutes"));
        assertEquals(3, ((Map<String, Object>) tier3Lockout.get("lock")).get("lockoutTier"));

        // 6. Simulate cooldown expiry & submit correct 4-digit PIN -> unlocks cleanly & allows saving marks
        lockRow = topicMarkLockRepository.findByClassIdAndTopicCode(java01.getId(), topicCode).orElseThrow();
        lockRow.setCooldownUntil(Instant.now().minusSeconds(1));
        topicMarkLockRepository.saveAndFlush(lockRow);

        Map<String, Object> unlockedRes = operationDatabaseService.unlockClassTopicMarks(
                java01.getId(), Map.of("topicCode", topicCode, "pin", issuedPin));
        assertEquals(Boolean.TRUE, unlockedRes.get("unlocked"));
        assertEquals(200, unlockedRes.get("httpStatus"));

        // Saving marks succeeds once unlocked
        Map<String, Object> savedAfterUnlock = operationDatabaseService.saveClassTopicMarks(
                java01.getId(),
                Map.of(
                        "topicCode", topicCode,
                        "recordsByTraineeId", Map.of("1001", Map.of("componentScores", sampleScores))
                )
        );
        assertNotNull(savedAfterUnlock.get("topics"));
    }
}
