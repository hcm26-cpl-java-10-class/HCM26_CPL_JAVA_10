package com.example.starter_project_2025.system.trainer;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.subject.Subject;
import net.bytebuddy.ByteBuddy;
import net.bytebuddy.implementation.FixedValue;
import net.bytebuddy.matcher.ElementMatchers;
import org.hibernate.proxy.HibernateProxy;
import org.hibernate.proxy.LazyInitializer;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class TrainerTest {

    @Test
    void create_normalizesIdentityAndEncapsulatesTeachingTopics() {
        Subject javaCore = new Subject();
        javaCore.setId(1L);
        javaCore.setCode("JAVA_CORE");

        Trainer trainer = Trainer.create(
                " tr_01 ",
                " Nguyễn Ngọc Tân ",
                " TAN@Example.COM ",
                " Java Backend ",
                TrainerStatus.ACTIVE,
                List.of(javaCore)
        );

        assertEquals("TR_01", trainer.getTrainerCode());
        assertEquals("Nguyễn Ngọc Tân", trainer.getFullName());
        assertEquals("tan@example.com", trainer.getEmail());
        assertEquals("Java Backend", trainer.getSpecialization());
        assertTrue(trainer.isActiveTrainer());
        assertFalse(trainer.isArchived());
        assertTrue(trainer.canTeachTopic(1L));
        assertFalse(trainer.canTeachTopic(2L));
        assertThrows(UnsupportedOperationException.class, () -> trainer.getTeachingTopics().clear());
    }

    @Test
    void failedUpdateProfile_leavesExistingStateCompletelyUnchanged() {
        Subject javaCore = new Subject();
        javaCore.setId(1L);
        Subject springBoot = new Subject();
        springBoot.setId(2L);

        Trainer trainer = Trainer.create(
                "TR_01",
                "Original Name",
                "original@example.com",
                "Java",
                TrainerStatus.ACTIVE,
                List.of(javaCore)
        );

        // Fails on invalid email after trainerCode & fullName would have been valid
        assertThrows(BadRequestException.class, () -> trainer.updateProfile(
                "TR_NEW",
                "New Name",
                "not-an-email",
                "Spring",
                TrainerStatus.INACTIVE,
                List.of(springBoot)
        ));

        // Every single field must remain intact (atomic validation before mutation)
        assertEquals("TR_01", trainer.getTrainerCode());
        assertEquals("Original Name", trainer.getFullName());
        assertEquals("original@example.com", trainer.getEmail());
        assertEquals("Java", trainer.getSpecialization());
        assertEquals(TrainerStatus.ACTIVE, trainer.getStatus());
        assertTrue(trainer.canTeachTopic(1L));
        assertFalse(trainer.canTeachTopic(2L));
    }

    @Test
    void archive_andIdentityImmutability_preventBypassThroughBaseEntitySetters() {
        Trainer trainer = Trainer.create("TR_02", "Trainer Two", "two@example.com", "", TrainerStatus.ACTIVE, List.of());
        trainer.setId(10L);
        assertThrows(UnsupportedOperationException.class, () -> trainer.setId(20L));

        trainer.deactivate();
        assertEquals(TrainerStatus.INACTIVE, trainer.getStatus());
        assertFalse(trainer.isActiveTrainer());

        trainer.activate();
        assertEquals(TrainerStatus.ACTIVE, trainer.getStatus());
        assertTrue(trainer.isActiveTrainer());

        trainer.archive();
        assertTrue(trainer.isArchived());
        assertEquals(TrainerStatus.INACTIVE, trainer.getStatus());
        assertFalse(trainer.isActiveTrainer());

        // Cannot reactivate archived trainer via domain methods OR inherited BaseEntity.setIsActive(true)
        assertThrows(ConflictException.class, () -> trainer.setIsActive(true));
        assertThrows(ConflictException.class, trainer::activate);
        assertThrows(ConflictException.class, () -> trainer.changeStatus(TrainerStatus.ACTIVE));
        assertThrows(ConflictException.class, () -> trainer.updateProfile(
                "TR_02", "Changed", "two@example.com", "", TrainerStatus.ACTIVE, List.of()));
    }

    @Test
    void create_rejectsBlankOverlengthOrInvalidInputsAndKeepsStableHashCode() {
        assertThrows(BadRequestException.class, () ->
                Trainer.create("  ", "Name", "a@b.com", "", TrainerStatus.ACTIVE, List.of()));
        assertThrows(BadRequestException.class, () ->
                Trainer.create("TR_03", "Name", "a@b.com", "", null, List.of()));
        assertThrows(BadRequestException.class, () ->
                Trainer.create("T".repeat(21), "Name", "a@b.com", "", TrainerStatus.ACTIVE, List.of()));
        assertThrows(BadRequestException.class, () ->
                Trainer.create("TR_04", "N".repeat(81), "a@b.com", "", TrainerStatus.ACTIVE, List.of()));
        assertThrows(BadRequestException.class, () ->
                Trainer.create("TR_04", "Name", "review@localhost", "", TrainerStatus.ACTIVE, List.of()));
        assertThrows(BadRequestException.class, () ->
                Trainer.create("TR_04", "Name", "user@domain.", "", TrainerStatus.ACTIVE, List.of()));

        Trainer t = Trainer.create("TR_05", "Stable", "stable@example.com", "Java", TrainerStatus.ACTIVE, List.of());
        Set<Trainer> set = new HashSet<>();
        set.add(t);
        int beforeHash = t.hashCode();
        t.setId(55L);
        t.updateProfile("TR_05B", "Renamed", "renamed@example.com", "Spring", TrainerStatus.INACTIVE, List.of());
        assertEquals(beforeHash, t.hashCode());
        assertTrue(set.contains(t));
    }

    @Test
    void equalsAndHashCode_areSymmetricBetweenEntityAndUninitializedHibernateProxy() throws Exception {
        Trainer transientA = Trainer.create("TR_10", "Transient A", "ta@example.com", "", TrainerStatus.ACTIVE, List.of());
        Trainer transientB = Trainer.create("TR_11", "Transient B", "tb@example.com", "", TrainerStatus.ACTIVE, List.of());
        assertNotEquals(transientA, transientB);

        Trainer real = Trainer.create("TR_12", "Persisted", "p@example.com", "", TrainerStatus.ACTIVE, List.of());
        real.setId(77L);
        Trainer uninitializedProxy = createUninitializedTrainerProxy(77L);
        Trainer differentIdProxy = createUninitializedTrainerProxy(78L);

        assertEquals(real, uninitializedProxy);
        assertEquals(uninitializedProxy, real);
        assertEquals(real.hashCode(), uninitializedProxy.hashCode());
        assertNotEquals(real, differentIdProxy);
        assertNotEquals(differentIdProxy, real);
    }

    private static Trainer createUninitializedTrainerProxy(Long proxyId) throws Exception {
        LazyInitializer initializer = (LazyInitializer) Proxy.newProxyInstance(
                LazyInitializer.class.getClassLoader(),
                new Class<?>[]{LazyInitializer.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getPersistentClass" -> Trainer.class;
                    case "getIdentifier" -> proxyId;
                    case "isUninitialized" -> true;
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    case "toString" -> "UninitializedTrainerLazyInitializer";
                    default -> throw new AssertionError("Unexpected proxy initialization call: " + method.getName());
                }
        );
        return new ByteBuddy()
                .subclass(Trainer.class)
                .implement(HibernateProxy.class)
                .method(ElementMatchers.named("getId")).intercept(FixedValue.value(proxyId))
                .method(ElementMatchers.named("getHibernateLazyInitializer")).intercept(FixedValue.value(initializer))
                .method(ElementMatchers.named("writeReplace")).intercept(FixedValue.nullValue())
                .make()
                .load(Trainer.class.getClassLoader())
                .getLoaded()
                .getDeclaredConstructor()
                .newInstance();
    }
}
