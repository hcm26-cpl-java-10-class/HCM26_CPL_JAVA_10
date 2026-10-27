package com.example.starter_project_2025.service;

import com.example.starter_project_2025.system.study_session.*;
import com.example.starter_project_2025.exception.BusinessValidationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class StudySessionStatisticsPersistenceTest {
    @Autowired TestEntityManager em;
    @Autowired StudySessionRepository repository;

    @Test
    void aggregatesAllRowsFiltersInclusivelyAndReflectsTransitions() {
        em.getEntityManager().createNativeQuery("SET REFERENTIAL_INTEGRITY FALSE").executeUpdate();
        var service = new StudySessionServiceImpl(null, repository, null, id -> false, event -> {}, null, null);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "reader", "", List.of(new SimpleGrantedAuthority("STUDY_SESSION_READ"),
                new SimpleGrantedAuthority("STUDY_SESSION_UPDATE"))));
        try {
            var empty = service.statistics(null, null, null);
            assertEquals(StudySessionStatistics.of(0, 0, 0), empty);
            StudySession first = null, second = null;
            for (int i = 0; i < 12; i++) {
                var session = new StudySession();
                session.setSubjectId(i == 11 ? 8L : 7L);
                session.setTitle("Statistics " + i);
                session.setSessionDate(LocalDate.parse(i == 10 ? "2026-10-22" : "2026-10-21"));
                session.setStartTime(LocalTime.of(8, 0));
                session.setEndTime(LocalTime.of(9, 0));
                session.setType(StudySessionType.LECTURE);
                em.persist(session);
                if (i == 0) first = session;
                if (i == 1) second = session;
            }
            em.flush();
            assertEquals(12, service.statistics(null, null, null).total());
            // Use the real lifecycle methods while keeping DTO mapping irrelevant to aggregation.
            var mapper = org.mockito.Mockito.mock(StudySessionMapper.class);
            var lifecycle = new StudySessionServiceImpl(mapper, repository, null, id -> false, event -> {}, null, null);
            lifecycle.complete(first.getId(), null);
            var cancel = new CancelSessionRequest();
            cancel.setReason("Unavailable");
            lifecycle.cancel(second.getId(), cancel);
            em.flush();
            var stats = service.statistics(null, null, null);
            assertEquals(StudySessionStatistics.of(10, 1, 1), stats);
            assertEquals(8.33, stats.completionRate());
            assertEquals(8.33, stats.cancellationRate());
            assertEquals(stats.total(), stats.scheduled() + stats.completed() + stats.cancelled());
            var date = LocalDate.parse("2026-10-21");
            assertEquals(10, service.statistics(7L, date, date).total());
            assertEquals(1, service.statistics(8L, null, null).total());
            assertEquals(1, service.statistics(null, date.plusDays(1), null).total());
            assertEquals(11, service.statistics(null, null, date).total());
            assertEquals(empty, service.statistics(999L, null, null));
            assertEquals(empty, service.statistics(null, date.plusDays(2), null));
            assertThrows(BusinessValidationException.class, () -> service.statistics(null, date.plusDays(1), date));
        } finally {
            SecurityContextHolder.clearContext();
            em.getEntityManager().createNativeQuery("SET REFERENTIAL_INTEGRITY TRUE").executeUpdate();
        }
    }
}
