package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import net.bytebuddy.ByteBuddy;
import net.bytebuddy.implementation.FixedValue;
import net.bytebuddy.matcher.ElementMatchers;
import org.hibernate.proxy.HibernateProxy;
import org.hibernate.proxy.LazyInitializer;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class SessionTest {

    private static Session scheduledSession(Long id) {
        Session session = Session.builder()
                .id(id)
                .classId(1L)
                .topicId(1L)
                .trainerId(1L)
                .title("[JAVA_CORE] OOP")
                .location("Lab 201")
                .build();
        session.initializeForSchedule("[JAVA_CORE] OOP", "Lab 201");
        session.scheduleSlot(LocalDateTime.of(2026, 10, 1, 8, 0), LocalDateTime.of(2026, 10, 1, 12, 0));
        return session;
    }

    @Test
    void sessionLifecycleTransitions_rejectInvalidTransitionsAndPreserveStateOnFailure() {
        Session session = scheduledSession(10L);

        // Blank cancel reason must fail without mutating status
        assertThrows(BadRequestException.class, () -> session.cancel("   "));
        assertEquals(Session.SessionStatus.SCHEDULED, session.getStatus());
        assertNull(session.getCancelReason());

        // Invalid reschedule window must fail without mutating startTime, endTime, or location
        LocalDateTime origStart = session.getStartTime();
        LocalDateTime origEnd = session.getEndTime();
        assertThrows(BadRequestException.class, () -> session.rescheduleTo(
                LocalDateTime.of(2026, 10, 2, 12, 0),
                LocalDateTime.of(2026, 10, 2, 12, 0),
                "Room 999"
        ));
        assertEquals(origStart, session.getStartTime());
        assertEquals(origEnd, session.getEndTime());
        assertEquals("Lab 201", session.getLocation());

        // Complete -> cannot cancel, reschedule, change slot, or complete again
        session.complete();
        assertEquals(Session.SessionStatus.COMPLETED, session.getStatus());
        assertThrows(ConflictException.class, () -> session.cancel("Too late"));
        assertThrows(ConflictException.class, () -> session.complete());
        assertThrows(ConflictException.class, () -> session.rescheduleTo(
                LocalDateTime.of(2026, 10, 3, 8, 0), LocalDateTime.of(2026, 10, 3, 10, 0), "Lab 202"));
        assertThrows(ConflictException.class, () -> session.scheduleSlot(
                LocalDateTime.of(2026, 10, 3, 8, 0), LocalDateTime.of(2026, 10, 3, 10, 0)));

        // Cancel -> cannot complete, reschedule, or cancel again
        Session cancelled = scheduledSession(11L);
        cancelled.cancel("  Trainer sick  ");
        assertEquals(Session.SessionStatus.CANCELLED, cancelled.getStatus());
        assertEquals("Trainer sick", cancelled.getCancelReason());
        assertThrows(ConflictException.class, cancelled::complete);
        assertThrows(ConflictException.class, () -> cancelled.cancel("Again"));
        assertThrows(ConflictException.class, () -> cancelled.rescheduleTo(
                LocalDateTime.of(2026, 10, 3, 8, 0), LocalDateTime.of(2026, 10, 3, 10, 0), "Lab 202"));
    }

    @Test
    void equalsAndHashCode_remainStableAcrossRescheduleAndTransientToPersistedLifecycle() {
        Session transientA = scheduledSession(null);
        Session transientB = scheduledSession(null);
        assertNotEquals(transientA, transientB, "Two distinct transient entities must not be equal");
        assertEquals(transientA, transientA);

        Set<Session> set = new HashSet<>();
        set.add(transientA);
        int hashBeforePersist = transientA.hashCode();

        // Simulate JPA assigning ID and rescheduling mutable fields
        transientA.setId(42L);
        transientA.rescheduleTo(
                LocalDateTime.of(2026, 10, 10, 13, 30),
                LocalDateTime.of(2026, 10, 10, 17, 30),
                "Room 304"
        );
        transientA.setTitle("[SPRING_BOOT] Updated");

        assertEquals(hashBeforePersist, transientA.hashCode());
        assertTrue(set.contains(transientA), "HashSet lookup must remain valid after persist and reschedule");

        Session persistedSameId = scheduledSession(42L);
        Session persistedOtherId = scheduledSession(43L);
        assertEquals(transientA, persistedSameId);
        assertEquals(transientA.hashCode(), persistedSameId.hashCode());
        assertNotEquals(transientA, persistedOtherId);
    }

    @Test
    void cancelledInvariant_enforcedInBuilderJpaCallbackAndInitializeForSchedule() throws Exception {
        // Builder rejects CANCELLED without cancelReason (null or blank)
        assertThrows(IllegalStateException.class, () -> Session.builder()
                .classId(1L).topicId(1L).trainerId(1L).title("Missing reason")
                .startTime(LocalDateTime.of(2026, 10, 1, 8, 0))
                .endTime(LocalDateTime.of(2026, 10, 1, 10, 0))
                .status(Session.SessionStatus.CANCELLED)
                .build());
        assertThrows(IllegalStateException.class, () -> Session.builder()
                .classId(1L).topicId(1L).trainerId(1L).title("Blank reason")
                .startTime(LocalDateTime.of(2026, 10, 1, 8, 0))
                .endTime(LocalDateTime.of(2026, 10, 1, 10, 0))
                .status(Session.SessionStatus.CANCELLED)
                .cancelReason("   ")
                .build());

        // JPA lifecycle callback rejects CANCELLED without cancelReason even if mutated via reflection
        Session raw = new Session();
        Field statusField = Session.class.getDeclaredField("status");
        statusField.setAccessible(true);
        statusField.set(raw, Session.SessionStatus.CANCELLED);
        assertThrows(IllegalStateException.class, raw::ensureValidState);

        // initializeForSchedule must not reset COMPLETED or CANCELLED sessions back to SCHEDULED
        Session completed = scheduledSession(20L);
        completed.complete();
        assertThrows(ConflictException.class, () -> completed.initializeForSchedule("Reopen", "Room 1"));
        assertEquals(Session.SessionStatus.COMPLETED, completed.getStatus());

        Session cancelled = scheduledSession(21L);
        cancelled.cancel("Weather");
        assertThrows(ConflictException.class, () -> cancelled.initializeForSchedule("Reopen", "Room 1"));
        assertEquals(Session.SessionStatus.CANCELLED, cancelled.getStatus());
        assertEquals("Weather", cancelled.getCancelReason());
    }

    @Test
    void equalsAndHashCode_areSymmetricBetweenEntityAndUninitializedHibernateProxy() throws Exception {
        Session real = scheduledSession(99L);
        Session uninitializedProxy = createUninitializedSessionProxy(99L);
        Session differentIdProxy = createUninitializedSessionProxy(100L);

        assertEquals(real, uninitializedProxy);
        assertEquals(uninitializedProxy, real);
        assertEquals(real.hashCode(), uninitializedProxy.hashCode());
        assertNotEquals(real, differentIdProxy);
        assertNotEquals(differentIdProxy, real);
    }

    private static Session createUninitializedSessionProxy(Long proxyId) throws Exception {
        LazyInitializer initializer = (LazyInitializer) Proxy.newProxyInstance(
                LazyInitializer.class.getClassLoader(),
                new Class<?>[]{LazyInitializer.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getPersistentClass" -> Session.class;
                    case "getIdentifier" -> proxyId;
                    case "isUninitialized" -> true;
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    case "toString" -> "UninitializedSessionLazyInitializer";
                    default -> throw new AssertionError("Unexpected proxy initialization call: " + method.getName());
                }
        );
        return new ByteBuddy()
                .subclass(Session.class)
                .implement(HibernateProxy.class)
                .method(ElementMatchers.named("getId")).intercept(FixedValue.value(proxyId))
                .method(ElementMatchers.named("getHibernateLazyInitializer")).intercept(FixedValue.value(initializer))
                .method(ElementMatchers.named("writeReplace")).intercept(FixedValue.nullValue())
                .make()
                .load(Session.class.getClassLoader())
                .getLoaded()
                .getDeclaredConstructor()
                .newInstance();
    }
}
