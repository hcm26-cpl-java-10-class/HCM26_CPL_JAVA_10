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
        // Video program FR_NFP_JAVA_2 (from FAMS frame_009.jpg & frame_006.jpg)
        ensureProgram("FR_NFP_JAVA_2", "[NFP] Fresher Full-stack Java Developer for SCM", "1.0", "-",
                "JAVA", "https://levelup.akajob.io/#/curricula/65db2e93-b8a4-4d1a-8ce8-7bb797d02e07", "Use LMS to learn",
                ProgramStatus.ACTIVE, List.of(
                        "L1_AL_CCGM", "L1_AL_GC", "L1_AL_TME", "L1_AL_PSE", "L1_AL_CFFI",
                        "L1_AL_ECWL", "L1_AL_TESO", "L1_AL_DF", "L1_AL_DSAA", "L1_AL_FF",
                        "L1_AL_AAE", "L1_AL_APWS", "L1_AL_VCG", "L2_JA_JS", "L2_AN_AE",
                        "L2_JA_ORM", "L3_JSFW", "L4_MOCK_PROJECT"
                ));

        ensureProgram("FULLSTACK_JAVA", "Fullstack Java & React Developer", "1.0", "HCM",
                "Backend", "", "Fullstack training track for freshers",
                ProgramStatus.ACTIVE, List.of("DATABASE_SQL", "JAVA_CORE", "SPRING_BOOT", "REACT_FRONTEND", "DEVOPS_BASIC"));

        ensureProgram("BACKEND_JAVA", "Enterprise Java Backend Specialist", "1.0", "HN",
                "Backend", "", "Backend specialist training track",
                ProgramStatus.ACTIVE, List.of("DATABASE_SQL", "JAVA_CORE", "SPRING_BOOT", "TESTING_QA"));

        ensureProgram("FRONTEND_REACT", "Modern Web Development with React", "1.0", "DN",
                "Frontend", "", "Frontend specialization",
                ProgramStatus.INACTIVE, List.of("REACT_FRONTEND", "DEVOPS_BASIC"));

        log.info("Ensured sample training program data.");
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
