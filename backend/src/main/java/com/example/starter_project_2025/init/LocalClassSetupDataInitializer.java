package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.trainingprogram.AssignmentRole;
import com.example.starter_project_2025.system.trainingprogram.ClassSetupService;
import com.example.starter_project_2025.system.trainingprogram.ClassTopicCourse;
import com.example.starter_project_2025.system.trainingprogram.ClassTopicCourseRepository;
import com.example.starter_project_2025.system.trainingprogram.ClassTrainingProgramRepository;
import com.example.starter_project_2025.system.trainingprogram.ProgramSubject;
import com.example.starter_project_2025.system.trainingprogram.ProgramSubjectRequest;
import com.example.starter_project_2025.system.trainingprogram.TeachingAssignment;
import com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentRepository;
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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.IntStream;

@Slf4j
@Component
@Profile("local")
@Order(20)
@RequiredArgsConstructor
public class LocalClassSetupDataInitializer implements CommandLineRunner {
    private final SubjectRepository subjectRepository;
    private final CourseRepository courseRepository;
    private final TrainingProgramRepository programRepository;
    private final TrainingProgramService programService;
    private final ClassTrainingProgramRepository classProgramRepository;
    private final ClassTopicCourseRepository classTopicCourseRepository;
    private final TeachingAssignmentRepository teachingAssignmentRepository;
    private final SessionRepository sessionRepository;
    private final ClassSetupService classSetupService;

    @Override
    @Transactional
    public void run(String... args) {
        var javaProgram = programRepository.findByCodeAndVersion("LOCAL_JAVA", "1.0").orElseGet(() -> {
            var codes = List.of("JAVA_CORE", "DATABASE_SQL", "SPRING_BOOT");
            var subjects = IntStream.range(0, codes.size())
                    .mapToObj(index -> new ProgramSubjectRequest(subjectRepository
                            .findByCodeAndVersion(codes.get(index), "1.0").orElseThrow().getId(), index + 1))
                    .toList();
            var created = programService.create(new TrainingProgramRequest(
                    "LOCAL_JAVA", "Chương trình Java Backend mẫu", "1.0", "HCM", subjects));
            programService.activate(created.id());
            return programRepository.findById(created.id()).orElseThrow();
        });

        programRepository.findByCodeAndVersion("LOCAL_FULLSTACK", "1.0").orElseGet(() -> {
            var codes = List.of("JAVA_CORE", "DATABASE_SQL", "SPRING_BOOT", "REACT_FRONTEND", "DEVOPS_BASIC");
            var subjects = IntStream.range(0, codes.size())
                    .mapToObj(index -> new ProgramSubjectRequest(subjectRepository
                            .findByCodeAndVersion(codes.get(index), "1.0").orElseThrow().getId(), index + 1))
                    .toList();
            var created = programService.create(new TrainingProgramRequest(
                    "LOCAL_FULLSTACK", "Chương trình Java Fullstack mẫu", "1.0", "HCM", subjects));
            programService.activate(created.id());
            return programRepository.findById(created.id()).orElseThrow();
        });

        if (classProgramRepository.findByClassId(1L).isEmpty()) {
            classSetupService.assignProgram(1L, javaProgram.getId());
        }

        // Seed 1 linked LMS Course, 1 TeachingAssignment and 1 Session on Class 1 (JAVA_CORE)
        // so SCR-52 lock, program-change block, and partial missing-setup alerts are immediately demonstrable.
        ProgramSubject firstSubject = javaProgram.getSubjects().stream()
                .filter(ps -> "JAVA_CORE".equals(ps.getSubject().getCode()))
                .findFirst()
                .orElse(null);

        if (firstSubject != null) {
            if (classTopicCourseRepository.findByClassIdAndProgramSubject_Id(1L, firstSubject.getId()).isEmpty()) {
                courseRepository.findByCode("CRS-JAVA-101").ifPresent(course -> {
                    ClassTopicCourse link = new ClassTopicCourse();
                    link.setClassId(1L);
                    link.setProgramSubject(firstSubject);
                    link.setCourse(course);
                    classTopicCourseRepository.save(link);
                });
            }

            TeachingAssignment assignment = teachingAssignmentRepository.findByClassIdOrderByEffectiveFromAscIdAsc(1L)
                    .stream()
                    .findFirst()
                    .orElseGet(() -> {
                        TeachingAssignment created = new TeachingAssignment();
                        created.setClassId(1L);
                        created.setProgramSubject(firstSubject);
                        created.setTrainerId(1L);
                        created.setRole(AssignmentRole.MAIN);
                        created.setEffectiveFrom(LocalDate.of(2026, 10, 1));
                        created.setEffectiveTo(LocalDate.of(2027, 1, 31));
                        return teachingAssignmentRepository.save(created);
                    });

            if (sessionRepository.findByClassId(1L).isEmpty()) {
                sessionRepository.save(Session.builder()
                        .classId(1L)
                        .topicId(firstSubject.getSubject().getId())
                        .trainerId(1L)
                        .teachingAssignmentId(assignment.getId())
                        .roomId(1L)
                        .location("Phòng mẫu A101")
                        .title("Java Core - Buổi 01: OOP & Collections")
                        .startTime(LocalDateTime.of(2026, 11, 2, 8, 30))
                        .endTime(LocalDateTime.of(2026, 11, 2, 11, 30))
                        .status(Session.SessionStatus.SCHEDULED)
                        .note("Buổi học mẫu khởi tạo cho kế hoạch môn học lớp LOCAL_JAVA_01")
                        .isActive(true)
                        .build());
            }
        }

        log.info("LOCAL SAMPLE DATA enabled: classes, trainers, rooms, LMS courses and Java training programs. "
                + "Changes in the in-memory database are cleared when the application stops.");
    }
}
