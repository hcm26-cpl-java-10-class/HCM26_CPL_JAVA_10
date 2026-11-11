package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Order(3)
@Component
@RequiredArgsConstructor
public class UserDataInitializer implements CommandLineRunner {

  private static final String STUDENT_EMAIL = "student@example.com";
  private static final String TEACHER_EMAIL = "teacher@example.com";
  private static final String LEGACY_JANE_EMAIL = "jane.smith@example.com";
  private static final String DEFAULT_PASSWORD = "password123";

  private final UserRepository userRepository;
  private final RoleRepository roleRepository;
  private final PasswordEncoder passwordEncoder;

  @Value("${app.seed.admin.email:admin@example.com}")
  private String adminEmail;

  @Value("${app.seed.admin.password:password123}")
  private String adminPassword;

  @Value("${app.seed.admin.first-name:Admin}")
  private String adminFirstName;

  @Value("${app.seed.admin.last-name:User}")
  private String adminLastName;

  @Override
  @Transactional
  public void run(String... args) {
    Role adminRole = roleRepository.findByName("ADMIN")
            .orElseThrow(() -> new IllegalStateException("Role ADMIN not found. Ensure role seed runs first."));
    Role studentRole = roleRepository.findByName("STUDENT")
            .orElseThrow(() -> new IllegalStateException("Role STUDENT not found. Ensure role seed runs first."));
      Role teacherRole = roleRepository.findByName("TEACHER")
        .orElseThrow(() -> new IllegalStateException("Role TEACHER not found. Ensure role seed runs first."));

      ensureUserWithRole(adminEmail, adminPassword, adminFirstName, adminLastName, adminRole, false);
      ensureUserWithRole(STUDENT_EMAIL, DEFAULT_PASSWORD, "John", "Doe", studentRole, true);
      ensureUserWithRole(TEACHER_EMAIL, DEFAULT_PASSWORD, "Teacher", "User", teacherRole, true);
      deactivateLegacyJaneAccount();

    log.info("Ensured seed users and role assignments.");
  }

  private void ensureUserWithRole(
          String email,
          String rawPassword,
          String firstName,
          String lastName,
          Role role,
          boolean replaceExistingRoles
  ) {
    User user = userRepository.findByEmail(email).orElseGet(User::new);

    if (user.getId() == null) {
      user.setEmail(email);
      user.setPasswordHash(passwordEncoder.encode(rawPassword));
      user.setFirstName(firstName);
      user.setLastName(lastName);
    } else {
      if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
      }

      if (user.getFirstName() == null || user.getFirstName().isBlank()) {
        user.setFirstName(firstName);
      }

      if (user.getLastName() == null || user.getLastName().isBlank()) {
        user.setLastName(lastName);
      }
    }

    user.setIsActive(true);

    if (replaceExistingRoles) {
      user.getRoles().clear();
    }

    user.getRoles().add(role);

    userRepository.save(user);
  }

  private void deactivateLegacyJaneAccount() {
    userRepository.findByEmail(LEGACY_JANE_EMAIL)
            .ifPresent(legacyUser -> {
              if (!Boolean.TRUE.equals(legacyUser.getIsActive())) {
                return;
              }

              legacyUser.setIsActive(false);
              userRepository.save(legacyUser);

              log.info("Disabled legacy seed user: {}", LEGACY_JANE_EMAIL);
            });
  }
}
