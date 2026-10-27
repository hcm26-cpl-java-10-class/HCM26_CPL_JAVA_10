package com.example.starter_project_2025.service;

import com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder;
import com.example.starter_project_2025.system.study_session.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.LocalDate;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

// Dedicated in-memory database; no application startup, seeders or external database.
@DataJpaTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:study_session_filter_test",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class StudySessionSearchFilterTest {
    @Autowired TestEntityManager em;
    @Autowired StudySessionRepository repository;

    @Test
    void searchesCombinesFiltersPaginatesSortsAndResets() {
        // Disable only the subject foreign key in this isolated test database.
        em.getEntityManager().createNativeQuery("SET REFERENTIAL_INTEGRITY FALSE").executeUpdate();
        save("Java Basics", 7L, StudySessionType.LECTURE, SessionStatus.SCHEDULED, "2026-10-20");
        save("Java Advanced", 7L, StudySessionType.LAB, SessionStatus.SCHEDULED, "2026-10-21");
        save("Python Basics", 8L, StudySessionType.LAB, SessionStatus.COMPLETED, "2026-10-22");
        save("Cancelled Java", 7L, StudySessionType.EXAM, SessionStatus.CANCELLED, "2026-10-23");
        em.flush();
        var mapper = mock(StudySessionMapper.class);
        when(mapper.toResponse(any())).thenAnswer(call -> {
            StudySession session = call.getArgument(0);
            var dto = new StudySessionDTO();
            dto.setTitle(session.getTitle());
            return dto;
        });
        var service = new StudySessionServiceImpl(mapper, repository, null, null, null, null, null);
        ReflectionTestUtils.setField(service, "autoSpecBuilder", new AutoSpecBuilder());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            "tester", "", List.of(new SimpleGrantedAuthority("STUDY_SESSION_READ"))));
        try {
            var page = PageRequest.of(0, 1, Sort.by("title"));
            assertEquals(1, service.getAll(page, "Java Basics", null).getTotalElements());
            assertEquals(3, service.getAll(page, "jAvA", null).getTotalElements());
            var filter = new StudySessionFilter();
            filter.setSubjectId(7L);
            filter.setStatus(SessionStatus.SCHEDULED);
            filter.setSessionDateFrom(LocalDate.parse("2026-10-20"));
            filter.setSessionDateTo(LocalDate.parse("2026-10-21"));
            var first = service.getAll(page, "java", filter);
            assertEquals(2, first.getTotalElements());
            assertEquals("Java Advanced", first.getContent().getFirst().getTitle());
            assertEquals("Java Basics", service.getAll(page.next(), "java", filter).getContent().getFirst().getTitle());
            filter.setType(StudySessionType.LAB);
            assertEquals(1, service.getAll(page, null, filter).getTotalElements());
            filter.setType(StudySessionType.LECTURE);
            assertEquals(1, service.getAll(page, null, filter).getTotalElements());
            filter.setTitle("basics");
            filter.setLecturer("nguyen");
            filter.setRoom("a-3");
            assertEquals(1, service.getAll(page, null, filter).getTotalElements());
            filter.setRoom("missing");
            assertTrue(service.getAll(page, null, filter).isEmpty());
            assertEquals(4, service.getAll(page, "", new StudySessionFilter()).getTotalElements());
            assertEquals("Python Basics", service.getAll(PageRequest.of(0, 1, Sort.by("title").descending()), null, null).getContent().getFirst().getTitle());
            for (var status : SessionStatus.values()) {
                var statusFilter = new StudySessionFilter();
                statusFilter.setStatus(status);
                assertEquals(status == SessionStatus.SCHEDULED ? 2 : 1,
                    service.getAll(page, null, statusFilter).getTotalElements());
            }
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private void save(String title, Long subjectId, StudySessionType type, SessionStatus status, String date) {
        var session = new StudySession();
        session.setTitle(title);
        session.setSubjectId(subjectId);
        session.setType(type);
        session.setStatus(status);
        session.setSessionDate(LocalDate.parse(date));
        session.setStartTime(java.time.LocalTime.of(8, 0));
        session.setEndTime(java.time.LocalTime.of(9, 0));
        session.setLecturer("Nguyen Van An");
        session.setRoom("A-302");
        em.persist(session);
    }
}
