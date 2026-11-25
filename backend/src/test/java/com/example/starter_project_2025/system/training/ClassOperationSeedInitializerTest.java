package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.init.ClassOperationDataInitializer;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

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
}
