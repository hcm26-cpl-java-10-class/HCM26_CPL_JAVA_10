package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.schedule.trainingclass.ClassStatus;
import com.example.starter_project_2025.system.schedule.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.schedule.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.schedule.trainingclass.TrainingClassRevision;
import com.example.starter_project_2025.system.schedule.trainingclass.TrainingClassRevisionRepository;
import com.example.starter_project_2025.system.schedule.trainingclass.ClassRevisionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/** Class-only fixtures for DEV 1. These do not simulate a successful Start transition. */
@Component
@Profile("dev1-demo")
@Order(12)
@RequiredArgsConstructor
public class TrainingClassDemoDataInitializer implements CommandLineRunner {
    private final TrainingClassRepository repository;
    private final TrainingClassRevisionRepository revisions;

    @Override
    @Transactional
    public void run(String... args) {
        for (ClassStatus status : ClassStatus.values()) {
            seed("DEV1-JAVA-" + status.name(), status, true);
        }
        seed("DEV1-JAVA-INACTIVE", ClassStatus.PLANNING, false);
        seed("DEV1-JAVA-DRAFT", ClassStatus.PLANNING, true);
        seed("DEV1-JAVA-REVIEW", ClassStatus.PLANNING, true);
    }

    private void seed(String code, ClassStatus status, boolean active) {
        // Preserve edits and deactivation when the application restarts.
        if (repository.existsByCode(code)) return;
        TrainingClass trainingClass = repository.saveAndFlush(TrainingClass.builder()
                .code(code)
                .name("Java Fundamentals - " + status.name())
                .description("DEV 1 class fixture for " + status.name() + " editing.")
                .openClassRequestId(101L)
                .programVersionId(1L)
                .traineeType("FRESHER")
                .deliveryFormat("OFFLINE")
                .site("HCM")
                .location("Training room A")
                .startDate(LocalDate.of(2026, 10, 1))
                .endDate(LocalDate.of(2026, 12, 1))
                .capacity(25)
                .status(status)
                .isActive(active)
                .build());
        ClassRevisionStatus revisionStatus = code.endsWith("-DRAFT") ? ClassRevisionStatus.DRAFT
                : code.endsWith("-REVIEW") ? ClassRevisionStatus.UNDER_REVIEW : ClassRevisionStatus.ACTIVE;
        TrainingClassRevision revision = revisions.saveAndFlush(TrainingClassRevision.builder()
                .trainingClass(trainingClass).revisionNo(1).status(revisionStatus)
                .name(trainingClass.getName()).description(trainingClass.getDescription())
                .traineeType(trainingClass.getTraineeType()).deliveryFormat(trainingClass.getDeliveryFormat())
                .site(trainingClass.getSite()).location(trainingClass.getLocation())
                .startDate(trainingClass.getStartDate()).endDate(trainingClass.getEndDate())
                .capacity(trainingClass.getCapacity()).build());
        trainingClass.setLastIssuedRevisionNo(1);
        if (revisionStatus == ClassRevisionStatus.ACTIVE) trainingClass.setCurrentRevision(revision);
        else trainingClass.setPendingRevision(revision);
        repository.saveAndFlush(trainingClass);
    }
}
