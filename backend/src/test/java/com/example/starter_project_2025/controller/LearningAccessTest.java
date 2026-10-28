package com.example.starter_project_2025.controller;

import com.example.starter_project_2025.system.learning.*;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.access.AccessDeniedException;
import java.util.Arrays;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LearningAccessTest {
    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean LearningRecordsService service() { return mock(LearningRecordsService.class); }
        @Bean LearningRecordsController controller(LearningRecordsService service) {
            return new LearningRecordsController(service);
        }
    }
    AnnotationConfigApplicationContext context;
    LearningRecordsController controller;
    LearningRecordsService service;
    UserPrincipal principal;
    @BeforeEach void setup() {
        context = new AnnotationConfigApplicationContext(Config.class);
        controller = context.getBean(LearningRecordsController.class);
        service = context.getBean(LearningRecordsService.class);
        principal = new UserPrincipal(User.builder().id(7L).email("learner@example.com").build(), java.util.List.of());
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); context.close(); }
    void authenticate(String... permissions) {
        var authorities = Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, authorities));
    }
    @Test void adminOnlyCannotReadPersonalLearning() {
        authenticate("ADMIN_ACCESS", "USER_READ", "USER_LEARNING_READ", "ENROLLMENT_READ");
        assertThrows(AccessDeniedException.class, () -> controller.mine(principal));
        verifyNoInteractions(service);
    }
    @Test void personalLearningUsesPrincipalIdentity() {
        authenticate("LEARNER_ACCESS", "LEARNING_SELF_READ");
        controller.mine(principal);
        verify(service).forUser(7L);
    }
    @Test void learnerCannotInspectOtherUsers() {
        authenticate("LEARNER_ACCESS", "LEARNING_SELF_READ");
        assertThrows(AccessDeniedException.class, () -> controller.user(8L));
        verifyNoInteractions(service);
    }
    @Test void userReadAloneDoesNotGrantLearningInspection() {
        authenticate("ADMIN_ACCESS", "USER_READ");
        assertThrows(AccessDeniedException.class, () -> controller.user(8L));
    }
    @Test void inspectionRequiresUserScope() {
        authenticate("ADMIN_ACCESS", "USER_LEARNING_READ");
        assertThrows(AccessDeniedException.class, () -> controller.user(8L));
    }
    @Test void authorizedAdminCanInspectTarget() {
        authenticate("ADMIN_ACCESS", "USER_READ", "USER_LEARNING_READ");
        controller.user(8L);
        verify(service).forUser(8L);
    }
    @Test void dualAccountCanUseBothEndpoints() {
        authenticate("ADMIN_ACCESS", "USER_READ", "USER_LEARNING_READ", "LEARNER_ACCESS", "LEARNING_SELF_READ");
        controller.mine(principal);
        controller.user(8L);
        verify(service).forUser(7L);
        verify(service).forUser(8L);
    }
    @Test void teacherCannotInspectUsersOrReadPersonalLearning() {
        authenticate("ADMIN_ACCESS", "COURSE_READ", "BOOK_UPDATE");
        assertThrows(AccessDeniedException.class, () -> controller.mine(principal));
        assertThrows(AccessDeniedException.class, () -> controller.user(8L));
        verifyNoInteractions(service);
    }
    @Test void customRoleRequiresAllInspectionGrantsRegardlessOfRoleName() {
        authenticate("ROLE_CUSTOM_AUDITOR", "ADMIN_ACCESS", "USER_READ", "USER_LEARNING_READ");
        controller.user(8L);
        verify(service).forUser(8L);
        assertThrows(AccessDeniedException.class, () -> controller.mine(principal));
    }
}
