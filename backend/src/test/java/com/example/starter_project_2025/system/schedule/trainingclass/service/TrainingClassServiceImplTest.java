package com.example.starter_project_2025.system.schedule.trainingclass.service;

import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.security.AuditorProvider;
import com.example.starter_project_2025.system.schedule.trainingclass.*;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrainingClassServiceImplTest {
    @Mock TrainingClassRepository repository;
    @Mock TrainingClassRevisionRepository revisions;
    @Mock TrainingClassMapper mapper;
    @Mock ObjectProvider<ProgramVersionChecker> programProvider;
    @Mock ObjectProvider<OpenClassRequestChecker> requestProvider;
    @Mock ObjectProvider<TrainingClassChangeChecker> changeProvider;
    @Mock AuditorProvider auditor;
    TrainingClassServiceImpl service;
    TrainingClass trainingClass;

    @BeforeEach void setup() {
        service = new TrainingClassServiceImpl(repository, revisions, mapper, programProvider, requestProvider, changeProvider, auditor);
        trainingClass = TrainingClass.builder().id(1L).version(0L).name("Active name").code("JAVA")
                .programVersionId(1L).traineeType("FRESHER").deliveryFormat("OFFLINE").site("HCM").location("Room A")
                .startDate(LocalDate.of(2026,10,1)).endDate(LocalDate.of(2026,12,1)).capacity(20)
                .status(ClassStatus.ONGOING).build();
        when(repository.findForRevisionUpdate(1L)).thenReturn(Optional.of(trainingClass));
    }

    @Test void completedClassCannotCreateDraft() {
        trainingClass.setStatus(ClassStatus.COMPLETED);
        CreateClassDraftRequest request = new CreateClassDraftRequest(); request.setVersion(0L);
        assertThrows(ConflictException.class, () -> service.createDraft(1L, request));
        verifyNoInteractions(revisions);
    }

    @Test void missingDependencyCheckerPreservesActiveRevision() {
        TrainingClassRevision active = TrainingClassRevision.builder().id(10L).revisionNo(1).status(ClassRevisionStatus.ACTIVE).build();
        TrainingClassRevision proposed = TrainingClassRevision.builder().id(11L).version(0L).revisionNo(2).baseRevisionId(10L)
                .status(ClassRevisionStatus.UNDER_REVIEW).traineeType("FRESHER").deliveryFormat("OFFLINE")
                .site("HCM").location("Room A").startDate(trainingClass.getStartDate()).endDate(trainingClass.getEndDate()).capacity(30).build();
        trainingClass.setCurrentRevision(active); trainingClass.setPendingRevision(proposed);
        ClassRevisionActionRequest request = new ClassRevisionActionRequest(); request.setVersion(0L); request.setRevisionVersion(0L);
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.approve(1L,11L,request));
        assertEquals(503, error.getStatusCode().value());
        assertSame(active, trainingClass.getCurrentRevision());
        assertEquals(ClassRevisionStatus.ACTIVE, active.getStatus());
        assertEquals(ClassRevisionStatus.UNDER_REVIEW, proposed.getStatus());
        assertEquals(20, trainingClass.getCapacity());
        verifyNoInteractions(auditor);
        verify(repository, never()).saveAndFlush(any());
    }

    @Test void operationalRevisionPublishesOnlyAfterDependencyCheckerAcceptsIt() {
        TrainingClassRevision active = TrainingClassRevision.builder().id(10L).revisionNo(1).status(ClassRevisionStatus.ACTIVE).build();
        TrainingClassRevision proposed = TrainingClassRevision.builder().id(11L).version(0L).revisionNo(2).baseRevisionId(10L)
                .status(ClassRevisionStatus.UNDER_REVIEW).name("Approved proposal").traineeType("FRESHER").deliveryFormat("OFFLINE")
                .site("HCM").location("Room A").startDate(trainingClass.getStartDate()).endDate(trainingClass.getEndDate()).capacity(30).build();
        trainingClass.setCurrentRevision(active); trainingClass.setPendingRevision(proposed);
        TrainingClassChangeChecker checker = mock(TrainingClassChangeChecker.class);
        when(changeProvider.getIfAvailable()).thenReturn(checker);
        doAnswer(invocation -> {
            assertEquals(20, trainingClass.getCapacity());
            assertEquals(ClassRevisionStatus.ACTIVE, active.getStatus());
            return null;
        }).when(checker).validateForApproval(trainingClass, proposed);
        when(auditor.getCurrentAuditor()).thenReturn(Optional.of(1L));
        when(repository.saveAndFlush(trainingClass)).thenReturn(trainingClass);
        ClassRevisionActionRequest request = new ClassRevisionActionRequest(); request.setVersion(0L); request.setRevisionVersion(0L);
        service.approve(1L, 11L, request);
        verify(checker).validateForApproval(trainingClass, proposed);
        assertSame(proposed, trainingClass.getCurrentRevision());
        assertNull(trainingClass.getPendingRevision());
        assertEquals(ClassRevisionStatus.ARCHIVED, active.getStatus());
        assertEquals(ClassRevisionStatus.ACTIVE, proposed.getStatus());
        assertEquals(30, trainingClass.getCapacity());
        assertEquals(ClassStatus.ONGOING, trainingClass.getStatus());
    }
}
