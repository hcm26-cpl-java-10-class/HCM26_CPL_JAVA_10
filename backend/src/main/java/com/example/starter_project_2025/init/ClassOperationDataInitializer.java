package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.training.ClassOperationDatabaseService;
import com.example.starter_project_2025.system.training.TrainingClassRepository;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Order(30)
@Component
@RequiredArgsConstructor
public class ClassOperationDataInitializer implements CommandLineRunner {

    private final ClassOperationDatabaseService databaseService;
    private final TrainingClassRepository trainingClassRepository;

    @Override
    @Transactional
    public void run(String... args) {
        for (TrainingClass tc : trainingClassRepository.findAll()) {
            Long classId = tc.getId();
            databaseService.initializeOperationFromH2(classId);
            databaseService.initializeTopicAssessmentsFromH2(classId);
            databaseService.initializeActivitiesFromH2(classId);
            log.info("ClassOperationDataInitializer: Initialized operation, topic assessments, and activities from H2 entities for class {} (id={}).",
                    tc.getCode(), classId);
        }
    }
}
