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
