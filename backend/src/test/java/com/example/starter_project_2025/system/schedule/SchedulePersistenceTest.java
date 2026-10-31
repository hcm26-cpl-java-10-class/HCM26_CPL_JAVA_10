package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder;
import com.example.starter_project_2025.system.demo.session.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.*;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = {"spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false"})
@ContextConfiguration(classes = SchedulePersistenceTest.Config.class)
@ActiveProfiles("schedule-demo")
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class SchedulePersistenceTest {
    @TestConfiguration
    @EntityScan(basePackageClasses = {Session.class, ScheduleWriteLock.class})
    @EnableJpaRepositories(basePackageClasses = {SessionRepository.class, ScheduleWriteLockRepository.class})
    @Import({ScheduleValidationEngine.class, ScheduleRules.class, DemoScheduleReferenceProvider.class,
            SessionServiceImpl.class, SessionMapperImpl.class})
    static class Config {}

    @MockBean AutoSpecBuilder autoSpecBuilder;
    @Autowired SessionRepository repository;
    @Autowired ScheduleWriteLockRepository locks;
    @Autowired SessionService service;
    @Autowired ScheduleValidationEngine conflicts;
    @Autowired PlatformTransactionManager transactions;

    static void authenticate(String... permissions) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("scheduler", "",
                Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
    }
    @BeforeEach void setup() {
        repository.deleteAll();
        locks.saveAndFlush(new ScheduleWriteLock(1L));
        authenticate("SESSION_READ", "SESSION_CREATE", "SESSION_UPDATE");
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    SessionDTO request(String from, String until) {
        var dto = SessionDTO.builder().classId(1L).topicId(1L).trainerId(1L).teachingAssignmentId(1L).roomId(1L)
                .title("Java").startTime(LocalDateTime.parse("2026-10-21T" + from))
                .endTime(LocalDateTime.parse("2026-10-21T" + until)).build();
        dto.setIsActive(true);
        return dto;
    }

    @Test void createUpdateAndCancelUseRealDatabaseAndMapper() {
        var first = service.create(request("09:00", "10:00"));
        assertThrows(ScheduleValidationException.class, () -> service.create(request("09:30", "10:30")));
        assertEquals(1, repository.count());
        assertDoesNotThrow(() -> service.update(first.getId(), request("09:00", "10:00")));
        var adjacent = service.create(request("10:00", "11:00"));
        assertThrows(ScheduleValidationException.class, () -> service.update(adjacent.getId(), request("09:30", "10:30")));
        assertEquals(LocalDateTime.parse("2026-10-21T10:00"), repository.findById(adjacent.getId()).orElseThrow().getStartTime());
        var cancel = new SessionCancelDTO(); cancel.setCancelReason("Đổi kế hoạch");
        service.cancelSession(first.getId(), cancel);
        assertDoesNotThrow(() -> service.create(request("09:00", "10:00")));
    }
    @Test void invalidBatchLeavesNoPartialWrites() {
        assertThrows(ScheduleValidationException.class, () -> service.createValidatedBatch(List.of(request("09:00","10:00"),request("09:30","10:30"))));
        assertEquals(0, repository.count());
        assertEquals(2, service.createValidatedBatch(List.of(request("09:00","10:00"),request("10:00","11:00"))).size());
    }
    @Test void partialUpdateUsesUnchangedFieldsAndOnlineSwitchClearsRoom() {
        var first = service.create(request("09:00","10:00"));
        var patch = new SessionDTO(); patch.setTitle("Đổi tiêu đề");
        assertEquals("Đổi tiêu đề",service.update(first.getId(),patch).getTitle());
        var online = new SessionDTO(); online.setLocation(""); online.setMeetingUrl("https://meet.example/java");
        service.update(first.getId(),online);
        assertNull(repository.findById(first.getId()).orElseThrow().getRoomId());
    }
    @Test void unauthorizedWritesAreRejected() {
        authenticate("SESSION_READ");
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> service.create(request("09:00","10:00")));
        assertEquals(0, repository.count());
    }
    @Test void createCannotOverwriteAnExistingId() {
        var first=service.create(request("09:00","10:00"));
        var forged=request("10:00","11:00"); forged.setId(first.getId());
        assertNotEquals(first.getId(),service.create(forged).getId());
        assertEquals(2,repository.count());
    }
    @Test void concurrentRequestsCannotBothReserveTheSameResources() throws Exception {
        ExecutorService pool=Executors.newFixedThreadPool(2);
        CountDownLatch start=new CountDownLatch(1);
        Callable<Boolean> write=() -> {
            authenticate("SESSION_READ","SESSION_CREATE");
            try {
                assertTrue(start.await(5,TimeUnit.SECONDS));
                service.create(request("09:00","10:00"));
                return true;
            } catch (ScheduleValidationException ex) { return false; }
            finally { SecurityContextHolder.clearContext(); }
        };
        try {
            Future<Boolean> a=pool.submit(write), b=pool.submit(write);
            start.countDown();
            int successes=(a.get(15,TimeUnit.SECONDS)?1:0)+(b.get(15,TimeUnit.SECONDS)?1:0);
            assertEquals(1,successes);
            assertEquals(1,repository.count());
        } finally { pool.shutdownNow(); }
    }
    @Test void activationFailureRollsBackOtherWritesInSameTransaction() {
        service.create(request("09:00","10:00"));
        TransactionTemplate tx=new TransactionTemplate(transactions);
        assertThrows(ScheduleValidationException.class, () -> tx.execute(status -> {
            conflicts.lockForWrite();
            Session extra=Session.builder().classId(1L).topicId(1L).trainerId(1L).title("Temporary")
                    .startTime(LocalDateTime.parse("2026-10-21T12:00")).endTime(LocalDateTime.parse("2026-10-21T13:00"))
                    .status(Session.SessionStatus.SCHEDULED).isActive(true).build();
            repository.saveAndFlush(extra);
            var dto=request("09:00","10:00");
            conflicts.requireValidActivation(List.of(new ScheduleCandidate(null,1L,1L,1L,1L,1L,null,null,"Activation",dto.getStartTime(),dto.getEndTime())), Set.of());
            return null;
        }));
        assertEquals(1,repository.count());
    }
}
