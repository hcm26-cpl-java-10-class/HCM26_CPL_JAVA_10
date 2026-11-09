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
        log.info("TrainingProgramDataInitializer: clean state initialized (no hardcoded programs). Ready for dynamic data.");
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
