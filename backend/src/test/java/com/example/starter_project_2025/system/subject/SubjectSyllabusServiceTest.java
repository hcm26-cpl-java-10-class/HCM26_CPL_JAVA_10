package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.subject.dto.SubjectSyllabusDTO;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubjectSyllabusServiceTest {

    @Mock
    private SubjectRepository subjectRepository;
    @Mock
    private SubjectSyllabusRepository subjectSyllabusRepository;

    private SubjectSyllabusService syllabusService;

    @BeforeEach
    void setUp() {
        syllabusService = new SubjectSyllabusService(
                subjectRepository,
                subjectSyllabusRepository,
                new ObjectMapper()
        );
    }

    @Test
    void getSyllabus_returnsDefaultSkeletonWhenNotPersistedYet() {
        Subject subject = Subject.builder().id(145L).code("JAVA_CORE").name("Java Core").version("1.0").durationHours(40).build();
        when(subjectRepository.findById(145L)).thenReturn(Optional.of(subject));
        when(subjectSyllabusRepository.findBySubject_Id(145L)).thenReturn(Optional.empty());

        SubjectSyllabusDTO dto = syllabusService.getSyllabus(145L);

        assertEquals(145L, dto.getSubjectId());
        assertEquals(">= 6.0 / 10", dto.getPassScore());
        assertNotNull(dto.getChapters());
        assertTrue(dto.getChapters().isEmpty());
        assertNull(dto.getMeta());
        assertNull(dto.getAssessmentScheme());
    }

    @Test
    void saveAndResetSyllabus_persistsNormalizedJsonAndDeletesBySubjectId() {
        Subject subject = Subject.builder().id(145L).code("JAVA_CORE").name("Java Core").version("1.0").durationHours(40).build();
        when(subjectRepository.findById(145L)).thenReturn(Optional.of(subject));
        when(subjectSyllabusRepository.findBySubject_Id(145L)).thenReturn(Optional.empty());
        when(subjectSyllabusRepository.save(any(SubjectSyllabus.class))).thenAnswer(inv -> inv.getArgument(0));

        SubjectSyllabusDTO payload = SubjectSyllabusDTO.builder()
                .passScore("  >= 7.0 / 10  ")
                .meta(Map.of("syllabusCode", "JAVA-2026"))
                .chapters(List.of(Map.of("id", "ch-1", "title", "OOP Basics")))
                .assessmentScheme(List.of(Map.of("id", "asm-1", "category", "Final", "weight", 100)))
                .build();

        SubjectSyllabusDTO saved = syllabusService.saveSyllabus(145L, payload);

        assertEquals(145L, saved.getSubjectId());
        assertEquals(">= 7.0 / 10", saved.getPassScore());
        assertEquals("JAVA-2026", saved.getMeta().get("syllabusCode"));
        assertEquals(1, saved.getChapters().size());
        assertEquals(1, saved.getAssessmentScheme().size());

        ArgumentCaptor<SubjectSyllabus> captor = ArgumentCaptor.forClass(SubjectSyllabus.class);
        verify(subjectSyllabusRepository).save(captor.capture());
        assertTrue(Boolean.TRUE.equals(captor.getValue().getIsActive()));

        syllabusService.resetSyllabus(145L);
        verify(subjectSyllabusRepository).deleteBySubject_Id(145L);
    }

    @Test
    void getSyllabus_throwsWhenSubjectDoesNotExist() {
        when(subjectRepository.findById(999L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> syllabusService.getSyllabus(999L));
    }
}
