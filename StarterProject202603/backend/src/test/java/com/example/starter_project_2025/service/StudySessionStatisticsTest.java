package com.example.starter_project_2025.service;

import com.example.starter_project_2025.system.study_session.*;
import com.example.starter_project_2025.system.academic.subject.SubjectRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.AccessDeniedException;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudySessionStatisticsTest {
    @Test
    void countsSumToTotalAndRatesAreRoundedWithEmptyDataSafe() {
        var statistics = StudySessionStatistics.of(10, 1, 1);
        assertEquals(12, statistics.total());
        assertEquals(statistics.total(), statistics.scheduled() + statistics.completed() + statistics.cancelled());
        assertEquals(8.33, statistics.completionRate());
        assertEquals(8.33, statistics.cancellationRate());
        var empty = StudySessionStatistics.of(0, 0, 0);
        assertEquals(0, empty.total());
        assertEquals(0, empty.completionRate());
        assertEquals(0, empty.cancellationRate());
        assertEquals(100, StudySessionStatistics.of(0, 5, 0).completionRate());
        assertEquals(100, StudySessionStatistics.of(0, 0, 5).cancellationRate());
    }

    @Test
    void requiresReadPermissionBeforeQueryingDatabase() {
        var repository = mock(StudySessionRepository.class);
        var service = new StudySessionServiceImpl(mock(StudySessionMapper.class), repository, mock(SubjectRepository.class), null, null, null);
        try {
            SecurityContextHolder.clearContext();
            assertThrows(AccessDeniedException.class, () -> service.statistics(null, null, null));
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    "update-only", "", List.of(new SimpleGrantedAuthority("STUDY_SESSION_UPDATE"))));
            assertThrows(AccessDeniedException.class, () -> service.statistics(null, null, null));
            verifyNoInteractions(repository);
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    "read-only", "", List.of(new SimpleGrantedAuthority("STUDY_SESSION_READ"))));
            when(repository.countByStatus(null, null, null)).thenReturn(List.of());
            assertEquals(0, service.statistics(null, null, null).total());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
