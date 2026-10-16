package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.class_setup.*;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.subject.SubjectStatus;
import com.example.starter_project_2025.system.training_program.ProgramStatus;
import com.example.starter_project_2025.system.training_program.ProgramSubject;
import com.example.starter_project_2025.system.training_program.TrainingProgram;
import com.example.starter_project_2025.system.training_program.TrainingProgramRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Order(4)
@Component
@RequiredArgsConstructor
public class ClassSetupDataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final SubjectRepository subjectRepository;
    private final TrainingProgramRepository trainingProgramRepository;
    private final TrainingClassRepository trainingClassRepository;
    private final TeachingAssignmentRepository teachingAssignmentRepository;
    private final EnrollmentRepository enrollmentRepository;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Khởi tạo dữ liệu mẫu cho module Gán chương trình và Phân công giảng dạy (Tú)...");

        Role teacherRole = roleRepository.findByName("TEACHER").orElse(null);

        // 1. Khởi tạo Giảng viên mẫu
        User trainer1 = ensureTrainer("nguyenvana@example.com", "Nguyễn", "Văn A", teacherRole);
        User trainer2 = ensureTrainer("tranthib@example.com", "Trần", "Thị B", teacherRole);

        // 2. Khởi tạo Môn học mẫu (nếu chưa có)
        Subject subjectJava = ensureSubject("JAVA_CORE", "Java Core & OOP Fundamentals", 40);
        Subject subjectSpring = ensureSubject("SPRING_BOOT", "Spring Boot & RESTful APIs", 48);
        Subject subjectDb = ensureSubject("DATABASE", "Database Design & SQL", 32);

        // 3. Khởi tạo Chương trình đào tạo mẫu ở trạng thái ACTIVE
        TrainingProgram program = ensureProgram("PROG_JAVA_FULLSTACK", "Java Full-Stack Developer 2026", 1,
                List.of(subjectJava, subjectSpring, subjectDb));

        // 4. Khởi tạo Lớp học mẫu
        TrainingClass class1 = ensureClass("HCM26_CPL_JAVA_10", "HCM26 CPL Java Class 10", program.getId(),
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 12, 31), ClassStatus.IN_PROGRESS, 25);

        ensureClass("HCM26_CPL_JAVA_11", "HCM26 CPL Java Class 11", null,
                LocalDate.of(2026, 11, 1), LocalDate.of(2027, 1, 31), ClassStatus.PLANNING, 30);

        // 5. Khởi tạo Phân công giảng dạy mẫu (TeachingAssignment)
        if (!program.getSubjects().isEmpty() && teachingAssignmentRepository.findByClassIdAndIsActiveTrue(class1.getId()).isEmpty()) {
            ProgramSubject firstSubject = program.getSubjects().get(0); // JAVA_CORE

            // Giảng viên chính (MAIN)
            TeachingAssignment assignmentMain = TeachingAssignment.builder()
                    .classId(class1.getId())
                    .programSubjectId(firstSubject.getId())
                    .trainerId(trainer1.getId())
                    .role(AssignmentRole.MAIN)
                    .effectiveFrom(LocalDate.of(2026, 10, 20))
                    .effectiveTo(LocalDate.of(2026, 11, 30))
                    .isActive(true)
                    .build();
            teachingAssignmentRepository.save(assignmentMain);

            // Giảng viên phụ (ASSISTANT)
            TeachingAssignment assignmentAssistant = TeachingAssignment.builder()
                    .classId(class1.getId())
                    .programSubjectId(firstSubject.getId())
                    .trainerId(trainer2.getId())
                    .role(AssignmentRole.ASSISTANT)
                    .effectiveFrom(LocalDate.of(2026, 10, 20))
                    .effectiveTo(LocalDate.of(2026, 11, 30))
                    .isActive(true)
                    .build();
            teachingAssignmentRepository.save(assignmentAssistant);

            log.info("Đã tạo 2 phân công mẫu cho lớp {}", class1.getCode());
        }

        // 6. Khởi tạo Ghi danh học viên mẫu (Enrollment)
        userRepository.findByEmail("student@example.com").ifPresent(student -> {
            if (enrollmentRepository.findByClassIdAndStudentId(class1.getId(), student.getId()).isEmpty()) {
                Enrollment enrollment = Enrollment.builder()
                        .classId(class1.getId())
                        .studentId(student.getId())
                        .enrolledAt(LocalDate.of(2026, 10, 5))
                        .status(EnrollmentStatus.ENROLLED)
                        .isActive(true)
                        .build();
                enrollmentRepository.save(enrollment);
                log.info("Đã ghi danh học viên {} vào lớp {}", student.getFullName(), class1.getCode());
            }
        });

        log.info("Khởi tạo dữ liệu mẫu cho module Tú hoàn tất!");
    }

    private User ensureTrainer(String email, String firstName, String lastName, Role teacherRole) {
        return userRepository.findByEmail(email).orElseGet(() -> {
            User user = User.builder()
                    .email(email)
                    .firstName(firstName)
                    .lastName(lastName)
                    .passwordHash(passwordEncoder.encode("password123"))
                    .isActive(true)
                    .build();
            if (teacherRole != null) {
                user.getRoles().add(teacherRole);
            }
            return userRepository.save(user);
        });
    }

    private Subject ensureSubject(String code, String name, int durationHours) {
        return subjectRepository.findAll().stream()
                .filter(s -> s.getCode().equalsIgnoreCase(code))
                .findFirst()
                .orElseGet(() -> {
                    Subject s = Subject.builder()
                            .code(code)
                            .name(name)
                            .version("1.0")
                            .durationHours(durationHours)
                            .technicalGroup("Java")
                            .status(SubjectStatus.ACTIVE)
                            .isActive(true)
                            .build();
                    return subjectRepository.save(s);
                });
    }

    private TrainingProgram ensureProgram(String code, String name, int version, List<Subject> subjects) {
        return trainingProgramRepository.findAll().stream()
                .filter(p -> p.getCode().equalsIgnoreCase(code) && p.getVersion().equals(version))
                .findFirst()
                .orElseGet(() -> {
                    TrainingProgram p = TrainingProgram.builder()
                            .code(code)
                            .name(name)
                            .version(version)
                            .region("HCM")
                            .status(ProgramStatus.ACTIVE)
                            .isActive(true)
                            .build();

                    int order = 1;
                    for (Subject s : subjects) {
                        p.getSubjects().add(ProgramSubject.builder()
                                .program(p)
                                .subjectId(s.getId())
                                .orderIndex(order++)
                                .build());
                    }

                    return trainingProgramRepository.save(p);
                });
    }

    private TrainingClass ensureClass(String code, String name, Long programId,
                                      LocalDate startDate, LocalDate endDate,
                                      ClassStatus status, int plannedSize) {
        return trainingClassRepository.findByCode(code).orElseGet(() -> {
            TrainingClass c = TrainingClass.builder()
                    .code(code)
                    .name(name)
                    .programId(programId)
                    .startDate(startDate)
                    .endDate(endDate)
                    .status(status)
                    .plannedSize(plannedSize)
                    .isActive(true)
                    .build();
            return trainingClassRepository.save(c);
        });
    }
}
