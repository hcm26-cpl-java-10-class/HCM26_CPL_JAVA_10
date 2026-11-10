package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.trainingprogram.*;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Order(13)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TrainingProgramDataInitializer implements CommandLineRunner {

    TrainingProgramRepository programRepository;
    SubjectRepository subjectRepository;

    @Override
    @Transactional
    public void run(String... args) {
        ensureProgram("FULLSTACK_JAVA", "Fullstack Java Enterprise Developer", "1.0", "HCM",
                "Java", "https://levelup.akajob.io/", "Fullstack Java & Enterprise Architecture training track",
                ProgramStatus.ACTIVE, List.of("DATABASE_SQL", "JAVA_CORE", "SPRING_BOOT", "REACT_FRONTEND", "DEVOPS_BASIC"));

        ensureProgram("BACKEND_JAVA", "Enterprise Java Backend Specialist", "1.0", "HN",
                "Java", "", "Backend specialist track focusing on core architecture and Spring Boot APIs",
                ProgramStatus.ACTIVE, List.of("DATABASE_SQL", "JAVA_CORE", "SPRING_BOOT", "TESTING_QA"));

        ensureProgram("FOUNDATION_JAVA", "Java Fundamentals & Database Foundation", "1.0", "DN",
                "Java", "", "Foundation training program for new freshers",
                ProgramStatus.ACTIVE, List.of("DATABASE_SQL", "JAVA_CORE"));

        log.info("TrainingProgramDataInitializer: ensured standard baseline programs in H2 database.");
    }

    private void ensureProgram(String code, String name, String version, String region,
                               String technicalGroup, String contentLink, String description,
                               ProgramStatus status, List<String> subjectCodes) {
        if (programRepository.existsByCodeAndVersion(code, version)) {
            return;
        }

        TrainingProgram program = TrainingProgram.builder()
                .code(code)
                .name(name)
                .version(version)
                .region(region)
                .technicalGroup(technicalGroup)
                .contentLink(contentLink)
                .description(description)
                .status(status)
                .isActive(true)
                .build();

        List<ProgramSubject> programSubjects = new ArrayList<>();
        int order = 1;
        for (String subjectCode : subjectCodes) {
            Subject subject = subjectRepository.findByCodeAndVersion(subjectCode, "1.0")
                    .or(() -> subjectRepository.findByCodeAndVersion(subjectCode, "1.1"))
                    .orElse(null);
            if (subject != null) {
                ProgramSubject ps = new ProgramSubject();
                ps.setProgram(program);
                ps.setSubject(subject);
                ps.setOrderIndex(order++);
                ps.setSubjectCode(subject.getCode());
                ps.setSubjectName(subject.getName());
                ps.setSubjectVersion(subject.getVersion());
                ps.setDurationHours(subject.getDurationHours());
                programSubjects.add(ps);
            }
        }

        program.setSubjects(programSubjects);
        programRepository.save(program);
    }
}
