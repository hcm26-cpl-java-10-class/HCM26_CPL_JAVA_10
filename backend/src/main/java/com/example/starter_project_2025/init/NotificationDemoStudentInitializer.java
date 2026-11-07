package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.StudentUserCodeGenerator;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.time.LocalDateTime;
import java.util.HashSet;

@Slf4j
@Component
@Order(6)
@Profile("!prod & !test")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.notification-demo.student.enabled", havingValue = "true", matchIfMissing = true)
public class NotificationDemoStudentInitializer implements CommandLineRunner {
    private final DataSource dataSource;
    private final UserRepository users;
    private final RoleRepository roles;
    private final TrainingClassRepository classes;
    private final ClassMemberRepository classMembers;
    private final StudentUserCodeGenerator userCodeGenerator;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.admin.email:admin@example.com}")
    private String adminEmail;

    @Value("${app.notification-demo.student.email:notification.student.demo@example.test}")
    private String studentEmail;

    @Value("${app.notification-demo.student.password:Demo@123}")
    private String studentPassword;

    @Value("${app.notification-demo.student.class-code:DEMO-JAVA-26-01}")
    private String classCode;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        try (var connection = dataSource.getConnection()) {
            if (!connection.getMetaData().getURL().startsWith("jdbc:h2:")) return;
        }

        User admin = users.findByEmail(adminEmail)
                .orElseThrow(() -> new IllegalStateException("The existing admin account is required"));
        if (admin.getTenant() == null) {
            log.info("Notification demo student seed skipped: admin has no tenant.");
            return;
        }

        var trainingClass = classes.findByCodeAndTenantId(classCode, admin.getTenant().getId()).orElse(null);
        if (trainingClass == null) {
            log.info("Notification demo student seed skipped: class {} is not available in this tenant.", classCode);
            return;
        }

        var studentRole = roles.findByName("STUDENT")
                .orElseThrow(() -> new IllegalStateException("Role STUDENT not found"));
        User student = users.findByEmail(studentEmail).orElseGet(() -> {
            User newStudent = User.builder()
                    .email(studentEmail)
                    .username("notification.demo.student")
                    .employeeCode("DEMO-NOTIFICATION-001")
                    .firstName("Notification")
                    .lastName("Demo Student")
                    .tenant(admin.getTenant())
                    .passwordHash(passwordEncoder.encode(studentPassword))
                    .roles(new HashSet<>())
                    .build();
            newStudent.setIsActive(true);
            newStudent.setLocked(false);
            newStudent.getRoles().add(studentRole);
            userCodeGenerator.assignIfMissing(newStudent);
            return users.saveAndFlush(newStudent);
        });

        if (!admin.getTenant().getId().equals(student.getTenantId())) {
            throw new IllegalStateException("The reserved notification demo email belongs to another tenant");
        }
        if (!Boolean.TRUE.equals(student.getIsActive()) || Boolean.TRUE.equals(student.getLocked())) {
            student.setIsActive(true);
            student.setLocked(false);
        }
        student.getRoles().add(studentRole);
        userCodeGenerator.assignIfMissing(student);
        users.saveAndFlush(student);

        if (!classMembers.existsByTrainingClass_IdAndUser_Id(trainingClass.getId(), student.getId())) {
            ClassMember membership = ClassMember.builder()
                    .trainingClass(trainingClass)
                    .user(student)
                    .status(ClassMemberStatus.ACTIVE)
                    .joinedAt(LocalDateTime.now())
                    .build();
            classMembers.saveAndFlush(membership);
        }

        log.info("Notification demo student is ready: email={}, classCode={}.", studentEmail, classCode);
    }
}
