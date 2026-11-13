package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.exception.BusinessValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SyllabusCloBulkServiceTest {

    @Mock SyllabusRepository syllabuses;
    @Mock SyllabusCloRepository clos;
    @Mock SyllabusWorkflowService workflow;
    @Mock SyllabusTopicCloLinkRepository coverageLinks;
    @InjectMocks SyllabusCloService service;

    @Test
    void createsSequentialCodesAndOrdersInOneBatch() {
        Syllabus syllabus = new Syllabus();
        syllabus.setId(1L);
        SyllabusClo previous = new SyllabusClo();
        previous.setCode("CLO3");
        previous.setOrderIndex(7);
        previous.setDetails("Describe a working computer system");
        when(syllabuses.findById(1L)).thenReturn(Optional.of(syllabus));
        when(clos.findBySyllabus_IdOrderByOrderIndexAsc(1L)).thenReturn(List.of(previous));
        when(clos.saveAllAndFlush(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.createBulk(1L, new SyllabusCloService.BulkCloInput(List.of(
                "Explain basic Java language features",
                "Develop a small object-oriented project")));

        assertEquals(List.of("CLO4", "CLO5"), result.stream().map(SyllabusCloService.CloView::code).toList());
        assertEquals(List.of(8, 9), result.stream().map(SyllabusCloService.CloView::orderIndex).toList());
        verify(clos, times(1)).saveAllAndFlush(anyList());
    }

    @Test
    void rejectsDuplicateInBatchBeforeSavingAnything() {
        Syllabus syllabus = new Syllabus();
        syllabus.setId(1L);
        when(syllabuses.findById(1L)).thenReturn(Optional.of(syllabus));
        when(clos.findBySyllabus_IdOrderByOrderIndexAsc(1L)).thenReturn(List.of());

        assertThrows(BusinessValidationException.class, () -> service.createBulk(1L,
                new SyllabusCloService.BulkCloInput(List.of(
                        "Explain basic Java language features",
                        " explain  BASIC Java language features "))));
        verify(clos, never()).saveAllAndFlush(anyList());
    }
}
