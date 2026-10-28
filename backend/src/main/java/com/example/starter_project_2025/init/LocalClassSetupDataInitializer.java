package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.trainingprogram.ClassSetupService;
import com.example.starter_project_2025.system.trainingprogram.ClassTrainingProgramRepository;
import com.example.starter_project_2025.system.trainingprogram.ProgramSubjectRequest;
import com.example.starter_project_2025.system.trainingprogram.TrainingProgramRepository;
import com.example.starter_project_2025.system.trainingprogram.TrainingProgramRequest;
import com.example.starter_project_2025.system.trainingprogram.TrainingProgramService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.starter_project_2025.system.trainingprogram.AssignmentRole;
import com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentRequest;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.IntStream;

@Slf4j
@Component
@Profile("local")
@Order(20)
@RequiredArgsConstructor
public class LocalClassSetupDataInitializer implements CommandLineRunner {
    private final SubjectRepository subjectRepository;
    private final TrainingProgramRepository programRepository;
    private final TrainingProgramService programService;
    private final ClassTrainingProgramRepository classProgramRepository;
    private final ClassSetupService classSetupService;

    @Override
    @Transactional
    public void run(String... args) {
        var program = programRepository.findByCodeAndVersion("LOCAL_JAVA", "1.0").orElseGet(() -> {
            var codes = List.of("JAVA_CORE", "DATABASE_SQL", "SPRING_BOOT");
            var subjects = IntStream.range(0, codes.size())
                    .mapToObj(index -> new ProgramSubjectRequest(subjectRepository
                            .findByCodeAndVersion(codes.get(index), "1.0").orElseThrow().getId(), index + 1))
                    .toList();
            var created = programService.create(new TrainingProgramRequest(
                    "LOCAL_JAVA", "Chương trình Java mẫu", "1.0", "Local", subjects));
            programService.activate(created.id());
            return programRepository.findById(created.id()).orElseThrow();
        });
        if (classProgramRepository.findByClassId(1L).isEmpty()) {
            classSetupService.assignProgram(1L, program.getId());
            var classSubjects = classSetupService.getClassProgramSubjects(1L).subjects();
            if (classSubjects != null) {
                for (int i = 0; i < classSubjects.size(); i++) {
                    Long trainerId = (i == classSubjects.size() - 1) ? 2L : 1L;
                    classSetupService.createAssignment(new TeachingAssignmentRequest(
                            1L, classSubjects.get(i).programSubjectId(), trainerId, AssignmentRole.MAIN,
                            LocalDate.now().minusDays(30), null));
                }
            }
        }
        log.info("LOCAL SAMPLE DATA enabled: classes, trainers, rooms, a Java training program and teaching assignments. "
                + "Changes in the in-memory database are cleared when the application stops.");
    }
}
