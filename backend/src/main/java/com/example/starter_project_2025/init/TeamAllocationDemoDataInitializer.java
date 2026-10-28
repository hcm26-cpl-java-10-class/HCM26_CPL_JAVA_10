package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffAssignment;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffAssignmentRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffRoleType;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassStatus;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.rbac.user.StudentUserCodeGenerator;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Order(5)
@Component
@RequiredArgsConstructor
@Profile("!prod")
@ConditionalOnProperty(
        prefix = "app.seed.team-allocation",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
public class TeamAllocationDemoDataInitializer implements CommandLineRunner {

    private static final int MEMBERS_PER_CLASS = 35;
    private static final String EMAIL_DOMAIN = "team-allocation.example.test";

    private static final List<String> FAMILY_NAMES = List.of(
            "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan",
            "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ",
            "Ngô", "Dương", "Lý", "Đinh", "Mai", "Cao"
    );

    private static final List<String> MIDDLE_AND_GIVEN_NAMES = List.of(
            "Minh Anh", "Quốc Bảo", "Thảo Vy", "Gia Huy", "Khánh Linh",
            "Tuấn Kiệt", "Ngọc Hân", "Đức Anh", "Phương Thảo", "Hoàng Nam",
            "Bảo Ngọc", "Thanh Tùng", "Minh Khang", "Hải Yến", "Quang Huy",
            "Mai Phương", "Anh Duy", "Kim Ngân", "Đăng Khoa", "Thu Trang",
            "Trọng Nghĩa", "Diệu Linh", "Nhật Minh", "Tú Anh", "Văn Khôi",
            "Thùy Dương", "Đình Phúc", "Mỹ Linh", "Hữu Phước", "Thanh Hà",
            "Công Thành", "Yến Nhi", "Hoài An", "Xuân Bách", "Bích Ngọc"
    );

    private static final List<ClassSeed> CLASSES = List.of(
            new ClassSeed(
                    "DEMO-JAVA-26-01", "Lập trình Java 2026 - Lớp 01",
                    92601L, "Java Backend Development", 92601L, "Java 2026 - Đợt 1"),
            new ClassSeed(
                    "DEMO-JAVA-26-02", "Lập trình Java 2026 - Lớp 02",
                    92601L, "Java Backend Development", 92602L, "Java 2026 - Đợt 2"),
            new ClassSeed(
                    "DEMO-FE-26-01", "Frontend React 2026 - Lớp 01",
                    92602L, "Frontend Engineering with React", 92603L, "Frontend 2026 - Đợt 1"),
            new ClassSeed(
                    "DEMO-QA-26-01", "Kiểm thử tự động 2026 - Lớp 01",
                    92603L, "Quality Assurance and Test Automation", 92604L, "QA 2026 - Đợt 1"),
            new ClassSeed(
                    "DEMO-DATA-26-01", "Phân tích dữ liệu 2026 - Lớp 01",
                    92604L, "Applied Data Analytics", 92605L, "Data Analytics 2026 - Đợt 1")
    );

    private static final List<List<MentorSeed>> MENTORS_BY_CLASS = List.of(
            List.of(
                    new MentorSeed("Nguyễn Hoàng Minh", "mentor.java.minh"),
                    new MentorSeed("Trần Thu Hà", "mentor.java.ha")),
            List.of(
                    new MentorSeed("Lê Quốc Bảo", "mentor.java.bao"),
                    new MentorSeed("Phạm Ngọc Lan", "mentor.java.lan")),
            List.of(
                    new MentorSeed("Vũ Khánh Linh", "mentor.frontend.linh"),
                    new MentorSeed("Đỗ Anh Tuấn", "mentor.frontend.tuan")),
            List.of(
                    new MentorSeed("Bùi Thanh Tâm", "mentor.qa.tam"),
                    new MentorSeed("Hoàng Đức Long", "mentor.qa.long")),
            List.of(
                    new MentorSeed("Phan Mai Phương", "mentor.data.phuong"),
                    new MentorSeed("Đặng Gia Huy", "mentor.data.huy"))
    );

    private final TrainingClassRepository trainingClassRepository;
    private final ClassMemberRepository classMemberRepository;
    private final ClassStaffAssignmentRepository classStaffAssignmentRepository;
    private final UserRepository userRepository;
    private final StudentUserCodeGenerator studentUserCodeGenerator;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final com.example.starter_project_2025.system.project.workspace.config.LegacyH2ProjectSchemaMigration legacyMigration;

    @Value("${app.seed.admin.email:admin@example.com}")
    private String adminEmail;

    @Override
    @Transactional
    public void run(String... args) {
        var admin=userRepository.findByEmail(adminEmail).orElseThrow();
        backfillExistingSampleStudentCodes();
        if (legacyMigration.isMigratedDatabase()) {
            log.info("Team-allocation demo seed skipped to preserve imported class/tenant data.");
            return;
        }
        long demoTenantId = resolveDemoTenantId();
        Role studentRole = roleRepository.findByName("STUDENT")
                .orElseThrow(() -> new IllegalStateException(
                        "Role STUDENT not found. Ensure role seed runs first."));
        Role mentorRole = roleRepository.findByName("MENTOR")
                .orElseThrow(() -> new IllegalStateException(
                        "Role MENTOR not found. Ensure role seed runs first."));

        int createdClasses = 0;
        int createdUsers = 0;
        int createdMemberships = 0;

        for (int classIndex = 0; classIndex < CLASSES.size(); classIndex++) {
            ClassSeed classSeed = CLASSES.get(classIndex);
            TrainingClass trainingClass = trainingClassRepository
                    .findByCode(classSeed.code())
                    .map(existing -> migrateToTenant(existing, demoTenantId))
                    .orElseGet(() -> createClass(classSeed, demoTenantId));

            if (trainingClass.getId() == null) {
                trainingClass = trainingClassRepository.saveAndFlush(trainingClass);
                createdClasses++;
            } else if (trainingClass.getProgramName() == null
                    || trainingClass.getCohortName() == null) {
                if (trainingClass.getProgramName() == null) {
                    trainingClass.setProgramName(classSeed.programName());
                }
                if (trainingClass.getCohortName() == null) {
                    trainingClass.setCohortName(classSeed.cohortName());
                }
                trainingClass = trainingClassRepository.saveAndFlush(trainingClass);
            }

            List<MentorSeed> classMentors = MENTORS_BY_CLASS.get(classIndex);
            User defaultMentor = ensureMentor(classMentors.get(0), mentorRole);
            if (trainingClass.getMentorId() == null) {
                trainingClass.setMentorId(defaultMentor.getId());
                trainingClass = trainingClassRepository.saveAndFlush(trainingClass);
            }
            for (MentorSeed mentorSeed : classMentors) {
                User mentor = ensureMentor(mentorSeed, mentorRole);
                ensureClassMentorAssignment(trainingClass, mentor);
            }

            for (int rosterIndex = 0; rosterIndex < MEMBERS_PER_CLASS; rosterIndex++) {
                int globalIndex = classIndex * MEMBERS_PER_CLASS + rosterIndex;
                String email = String.format(
                        "student.%03d@%s", globalIndex + 1, EMAIL_DOMAIN);
                User user = userRepository.findByEmail(email).orElse(null);
                if (user == null) {
                    user = createStudent(globalIndex, studentRole, email);
                    user = userRepository.saveAndFlush(user);
                    createdUsers++;
                }
                boolean changed = studentUserCodeGenerator.assignIfMissing(user);
                if (user.getTenantId() == null) {
                    user.setTenant(admin.getTenant());
                    changed = true;
                }
                if (changed) userRepository.saveAndFlush(user);

                if (!classMemberRepository.existsByTrainingClass_IdAndUser_Id(
                        trainingClass.getId(), user.getId())) {
                    classMemberRepository.save(ClassMember.builder()
                            .trainingClass(trainingClass)
                            .user(user)
                            .status(ClassMemberStatus.ACTIVE)
                            .joinedAt(LocalDateTime.now().minusDays(30L + rosterIndex))
                            .build());
                    createdMemberships++;
                }
            }

            log.info(
                    "Demo class ready: code={}, classId={}, members={}",
                    trainingClass.getCode(),
                    trainingClass.getId(),
                    classMemberRepository.countByTrainingClass_Id(trainingClass.getId())
            );
        }

        classMemberRepository.flush();
        log.info(
                "Team-allocation demo data ensured: {} classes, {} students, "
                        + "{} memberships created, and {} classes have sample Mentors; "
                        + "target is 5 classes with 35 members each.",
                createdClasses,
                createdUsers,
                createdMemberships,
                CLASSES.size()
        );
    }

    private void backfillExistingSampleStudentCodes() {
        int updated = 0;
        for (User user : userRepository.findByEmailEndingWithIgnoreCase("@" + EMAIL_DOMAIN)) {
            boolean isStudent = user.getRoles().stream().anyMatch(role -> "STUDENT".equals(role.getName()));
            if (isStudent && studentUserCodeGenerator.assignIfMissing(user)) {
                userRepository.saveAndFlush(user);
                updated++;
            }
        }
        if (updated > 0) log.info("Assigned user codes to {} existing demo students.", updated);
    }

    private User ensureMentor(MentorSeed seed, Role mentorRole) {
        String email = seed.emailLocalPart() + "@" + EMAIL_DOMAIN;
        User mentor = userRepository.findByEmail(email)
                .orElseGet(() -> createMentor(seed, email, mentorRole));
        if (mentor.getId() == null) {
            mentor.setTenant(userRepository.findByEmail(adminEmail).orElseThrow().getTenant());
            mentor = userRepository.saveAndFlush(mentor);
        } else {
            if(mentor.getTenantId()==null)mentor.setTenant(userRepository.findByEmail(adminEmail).orElseThrow().getTenant());
            mentor.setIsActive(true);
            mentor.setLocked(true);
            mentor.getRoles().add(mentorRole);
            mentor = userRepository.saveAndFlush(mentor);
        }
        return mentor;
    }

    private User createMentor(MentorSeed seed, String email, Role mentorRole) {
        User mentor = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                .firstName(seed.fullName())
                .locked(true)
                .build();
        mentor.setIsActive(true);
        mentor.getRoles().add(mentorRole);
        return mentor;
    }

    private void ensureClassMentorAssignment(TrainingClass trainingClass, User mentor) {
        ClassStaffAssignment assignment = classStaffAssignmentRepository
                .findByTrainingClass_IdAndUser_IdAndRoleType(
                        trainingClass.getId(), mentor.getId(), ClassStaffRoleType.MENTOR)
                .orElseGet(() -> ClassStaffAssignment.builder()
                        .trainingClass(trainingClass)
                        .user(mentor)
                        .roleType(ClassStaffRoleType.MENTOR)
                        .build());
        assignment.setIsActive(true);
        classStaffAssignmentRepository.save(assignment);
    }

    private long resolveDemoTenantId() {
        return userRepository.findByEmail(adminEmail)
                .map(User::getTenant)
                .map(Tenant::getId)
                .orElseThrow(() -> new IllegalStateException(
                        "Admin tenant not found. Ensure user seed runs first."));
    }

    private TrainingClass migrateToTenant(TrainingClass trainingClass, long tenantId) {
        if (!Long.valueOf(tenantId).equals(trainingClass.getTenantId())) {
            trainingClass.setTenantId(tenantId);
            trainingClass = trainingClassRepository.saveAndFlush(trainingClass);
            log.info("Migrated demo class {} to tenant {}", trainingClass.getCode(), tenantId);
        }
        return trainingClass;
    }

    private TrainingClass createClass(ClassSeed seed, long tenantId) {
        return TrainingClass.builder()
                .code(seed.code())
                .name(seed.name())
                .tenantId(tenantId)
                .programId(seed.programId())
                .programName(seed.programName())
                .cohortId(seed.cohortId())
                .cohortName(seed.cohortName())
                .status(TrainingClassStatus.ONGOING)
                .build();
    }

    private User createStudent(int globalIndex, Role studentRole, String email) {
        String fullName = FAMILY_NAMES.get((globalIndex * 7) % FAMILY_NAMES.size())
                + " "
                + MIDDLE_AND_GIVEN_NAMES.get(globalIndex % MIDDLE_AND_GIVEN_NAMES.size());

        User student = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                .firstName(fullName)
                .lastName(null)
                .locked(true)
                .build();
        student.setIsActive(true);
        student.getRoles().add(studentRole);
        return student;
    }

    private record ClassSeed(
            String code,
            String name,
            long programId,
            String programName,
            long cohortId,
            String cohortName
    ) {
    }

    private record MentorSeed(String fullName, String emailLocalPart) {
    }
}
