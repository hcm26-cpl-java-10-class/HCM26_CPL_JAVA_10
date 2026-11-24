package com.example.starter_project_2025.system.calendar;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionDTO;
import com.example.starter_project_2025.system.demo.session.SessionService;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.training.ClassEnrollment;
import com.example.starter_project_2025.system.training.ClassEnrollmentRepository;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Proxy;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class CalendarPersonalScopeResolverTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private static User user(Long id, String email, String firstName, String lastName) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        u.setFirstName(firstName);
        u.setLastName(lastName);
        return u;
    }

    private static ClassEnrollment enrollment(Long classId, String email, ClassEnrollment.Status status, boolean active, boolean classActive) {
        TrainingClass cls = new TrainingClass();
        cls.setId(classId);
        cls.setIsActive(classActive);

        ClassEnrollment e = new ClassEnrollment();
        e.setTrainingClass(cls);
        e.setPersonalEmail(email);
        e.setStatus(status);
        e.setIsActive(active);
        return e;
    }

    private static ExternalApiService externalApiWithTrainers(List<ExternalTrainerDTO> trainers) {
        return (ExternalApiService) Proxy.newProxyInstance(
                ExternalApiService.class.getClassLoader(),
                new Class<?>[]{ExternalApiService.class},
                (proxy, method, args) -> "fetchTrainers".equals(method.getName()) ? trainers : List.of()
        );
    }

    private static ClassEnrollmentRepository enrollmentsReturning(List<ClassEnrollment> rows) {
        return (ClassEnrollmentRepository) Proxy.newProxyInstance(
                ClassEnrollmentRepository.class.getClassLoader(),
                new Class<?>[]{ClassEnrollmentRepository.class},
                (proxy, method, args) -> "findActiveByPersonalEmailsIgnoreCase".equals(method.getName()) ? rows : List.of()
        );
    }

    @Test
    void trainerWithUserIdDifferentFromExternalTrainerId_resolvesVerifiedTrainerIdByEmail() {
        CalendarPersonalScopeResolver resolver = new CalendarPersonalScopeResolver(
                externalApiWithTrainers(List.of(
                        new ExternalTrainerDTO(1L, "Nguyễn Ngọc Tân (Trainer)", "trainer.tan@example.com", "active"),
                        new ExternalTrainerDTO(2L, "Other Trainer", "other@example.com", "active")
                )),
                enrollmentsReturning(List.of())
        );

        var scope = resolver.resolveFor(user(99L, " TRAINER.TAN@example.com ", "Nguyễn", "Ngọc Tân"));
        assertEquals(Set.of(1L), scope.trainerIds());
        assertTrue(scope.classIds().isEmpty());
    }

    @Test
    void numericIdOrNameCollisionAcrossSources_doesNotMatchWithoutVerifiedEmail() {
        CalendarPersonalScopeResolver resolver = new CalendarPersonalScopeResolver(
                externalApiWithTrainers(List.of(
                        new ExternalTrainerDTO(1L, "Nguyễn Ngọc Tân", "real.trainer@example.com", "active")
                )),
                enrollmentsReturning(List.of())
        );

        var scope = resolver.resolveFor(user(1L, "different.user@example.com", "Nguyễn", "Ngọc Tân"));
        assertTrue(scope.isEmpty(), "Must never match by numeric User.id or display name");
    }

    @Test
    void traineeWithEnrollment_includesOnlyActiveEnrollmentsInActiveClasses() {
        CalendarPersonalScopeResolver resolver = new CalendarPersonalScopeResolver(
                externalApiWithTrainers(List.of()),
                enrollmentsReturning(List.of(
                        enrollment(7L, "trainee@example.com", ClassEnrollment.Status.ACTIVE, true, true),
                        enrollment(8L, "trainee@example.com", ClassEnrollment.Status.DROPPED_OUT, true, true),
                        enrollment(9L, "trainee@example.com", ClassEnrollment.Status.INACTIVE, true, true),
                        enrollment(10L, "trainee@example.com", ClassEnrollment.Status.ACTIVE, true, false)
                ))
        );

        var scope = resolver.resolveFor(user(50L, "trainee@example.com", "Trainee", "One"));
        assertTrue(scope.trainerIds().isEmpty());
        assertEquals(Set.of(7L), scope.classIds());
    }

    @Test
    void mySessionsController_passesResolvedPersonalScopeAndValidatesMonthAndWeekBoundaries() {
        AtomicReference<Object[]> capturedArgs = new AtomicReference<>();
        SessionService sessionService = (SessionService) Proxy.newProxyInstance(
                SessionService.class.getClassLoader(),
                new Class<?>[]{SessionService.class},
                (proxy, method, args) -> {
                    if ("getCalendarSessions".equals(method.getName())) {
                        capturedArgs.set(args);
                        return Page.empty();
                    }
                    return null;
                }
        );

        CalendarPersonalScopeResolver resolver = new CalendarPersonalScopeResolver(
                externalApiWithTrainers(List.of(
                        new ExternalTrainerDTO(1L, "Trainer One", "real.trainer@example.com", "active")
                )),
                enrollmentsReturning(List.of())
        );
        CalendarController controller = new CalendarController(sessionService, resolver);

        // Unmapped user with colliding User.id = 1
        User unmapped = user(1L, "unmapped@example.com", "No", "Mapping");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(new UserPrincipal(unmapped, List.of()), null, List.of())
        );

        LocalDateTime octStart = LocalDateTime.of(2026, 10, 1, 0, 0);
        LocalDateTime novStart = LocalDateTime.of(2026, 11, 1, 0, 0);
        Page<SessionDTO> result = controller.getMySessions(octStart, novStart, null, null, 0, 200);
        assertTrue(result.isEmpty());

        Object[] myArgs = capturedArgs.get();
        assertNotNull(myArgs);
        assertEquals(octStart, myArgs[0]);
        assertEquals(novStart, myArgs[1]);
        assertTrue(new ArrayList<>((Collection<?>) myArgs[7]).isEmpty());
        assertTrue(new ArrayList<>((Collection<?>) myArgs[8]).isEmpty());
        assertEquals(Boolean.TRUE, myArgs[9]);

        // > 31 days rejected with 400 BAD_REQUEST
        ResponseStatusException tooLong = assertThrows(ResponseStatusException.class, () ->
                controller.getSessions(octStart, novStart.plusSeconds(1), null, null, null, null, null, 0, 50));
        assertEquals(HttpStatus.BAD_REQUEST, tooLong.getStatusCode());

        // Week boundary [Mon 00:00, next Mon 00:00)
        LocalDateTime weekStart = LocalDateTime.of(2026, 10, 5, 0, 0);
        LocalDateTime nextWeekStart = LocalDateTime.of(2026, 10, 12, 0, 0);
        controller.getSessions(weekStart, nextWeekStart, "SCHEDULED", 1L, null, null, null, 0, 200);
        Object[] weekArgs = capturedArgs.get();
        assertEquals(weekStart, weekArgs[0]);
        assertEquals(nextWeekStart, weekArgs[1]);
        assertEquals(Session.SessionStatus.SCHEDULED, weekArgs[2]);
        assertEquals(1L, weekArgs[3]);
        assertEquals(Boolean.FALSE, weekArgs[9]);
    }
}
