package com.example.starter_project_2025.system.project;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Makes sure every project has an operating window so the sprint validation
 * "sprint must stay inside the project timeline" (UFR-PRJ-003-01) has data to
 * work with. Only fills in missing values, existing windows are preserved.
 */
@Slf4j
@Order(13)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectWindowInitializer implements CommandLineRunner {

    private static final LocalDate DEFAULT_START = LocalDate.of(2025, 1, 1);
    private static final LocalDate DEFAULT_END = LocalDate.of(2027, 12, 31);

    ProjectRepository projectRepository;

    @Override
    @Transactional
    public void run(String... args) {

        int updated = 0;

        for (Project project : projectRepository.findAll()) {

            boolean changed = false;

            if (project.getStartDate() == null) {
                project.setStartDate(DEFAULT_START);
                changed = true;
            }

            if (project.getEndDate() == null) {
                project.setEndDate(DEFAULT_END);
                changed = true;
            }

            if (changed) {
                projectRepository.save(project);
                updated++;
            }
        }

        if (updated > 0) {
            log.info("Ensured operating window ({} - {}) for {} project(s).",
                    DEFAULT_START, DEFAULT_END, updated);
        }
    }
}
