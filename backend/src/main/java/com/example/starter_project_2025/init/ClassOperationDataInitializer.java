package com.example.starter_project_2025.init;

import com.example.starter_project_2025.config.startup.StartupMutation;

import com.example.starter_project_2025.system.training.ClassOperationDatabaseService;
import com.example.starter_project_2025.system.training.TrainingClassRepository;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Order(30)
@Component
@RequiredArgsConstructor
@StartupMutation
public class ClassOperationDataInitializer implements CommandLineRunner {

    private final ClassOperationDatabaseService databaseService;
    private final TrainingClassRepository trainingClassRepository;

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${app.seed.training-operation.force-in-memory:false}")
    private boolean forceInMemory;

    @Override
    @Transactional
    public void run(String... args) {
        boolean allowBaselineSeed = !datasourceUrl.startsWith("jdbc:h2:mem:") || forceInMemory;
        if (allowBaselineSeed) {
            databaseService.ensureDefaultTrainingClassesInH2();
        }
        for (TrainingClass tc : trainingClassRepository.findAll()) {
            Long classId = tc.getId();
            if (allowBaselineSeed) {
                databaseService.initializeEnrollmentsFromH2(tc);
            }
            databaseService.initializeOperationFromH2(classId);
            databaseService.initializeTopicAssessmentsFromH2(classId);
            databaseService.initializeTopicMarksFromH2(classId);
            databaseService.initializeActivitiesFromH2(classId);
            databaseService.initializeAttendanceFromH2(classId);
            log.info("ClassOperationDataInitializer: Initialized operation, topic assessments, activities, and attendances from H2 entities for class {} (id={}).",
                    tc.getCode(), classId);
        }
    }
}
