package com.example.starter_project_2025.system.question.version;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.question.core.domain.Difficulty;
import com.example.starter_project_2025.system.question.core.domain.Question;
import com.example.starter_project_2025.system.question.core.domain.QuestionOption;
import com.example.starter_project_2025.system.question.core.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;
import com.example.starter_project_2025.system.question.core.dto.QuestionDTO;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QuestionVersionServiceTest {

    private final QuestionVersionRepository repo = mock(QuestionVersionRepository.class);
    private final QuestionRepository questions = mock(QuestionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private QuestionVersionService service;

    @BeforeEach
    void setUp() {
        service = new QuestionVersionService(repo, questions, users);
    }

    private static Question mcq(long id, String content, boolean firstCorrect) {
        Question q = new Question();
        q.setId(id);
        q.setContent(content);
        q.setType(QuestionType.MULTIPLE_CHOICE);
        q.setDifficulty(Difficulty.EASY);
        q.setTopic("java");
        q.setPoints(1);
        QuestionOption a = new QuestionOption();
        a.setId(10L);
        a.setContent("A");
        a.setCorrect(firstCorrect);
        QuestionOption b = new QuestionOption();
        b.setId(11L);
        b.setContent("B");
        b.setCorrect(!firstCorrect);
        q.getOptions().add(a);
        q.getOptions().add(b);
        return q;
    }

    @Test
    void recordAssignsNextVersionNumber() {
        when(repo.maxVersion(5L)).thenReturn(2);

        service.record(mcq(5, "What is Java?", true), "Edited");

        ArgumentCaptor<QuestionVersion> cap = ArgumentCaptor.forClass(QuestionVersion.class);
        verify(repo).save(cap.capture());
        assertEquals(3, cap.getValue().getVersionNumber());
        assertEquals("Edited", cap.getValue().getNote());
        assertTrue(cap.getValue().getSnapshot().contains("What is Java?"));
    }

    @Test
    void examCopiesAndAiQuestionsAreNotTracked() {
        Question copy = mcq(6, "x", true);
        copy.setSourceQuestionId(1L);
        Question ai = mcq(7, "y", true);
        ai.setSource("AI_GENERATED");
        Question scoped = mcq(8, "z", true);
        scoped.setExamId(3L);

        service.record(copy, "Created");
        service.record(ai, "Created");
        service.record(scoped, "Created");

        verify(repo, never()).save(any());
    }

    @Test
    void baselineOnlyWhenNoHistoryYet() {
        when(repo.existsByQuestionId(5L)).thenReturn(true);
        service.ensureBaseline(mcq(5, "a", true));
        verify(repo, never()).save(any());

        when(repo.existsByQuestionId(9L)).thenReturn(false);
        when(repo.maxVersion(9L)).thenReturn(0);
        service.ensureBaseline(mcq(9, "a", true));
        verify(repo).save(any());
    }

    @Test
    void diffListsOnlyChangedFields() {
        QuestionSnapshot a = QuestionVersionService.snapshotOf(mcq(1, "Old text", true));
        QuestionSnapshot b = QuestionVersionService.snapshotOf(mcq(1, "New text", false));

        var changes = QuestionVersionService.diff(a, b);

        assertEquals(List.of("Content", "Answer options"), changes.stream().map(c -> c.field()).toList());
        assertEquals("Old text", changes.get(0).before());
        assertEquals("New text", changes.get(0).after());
    }

    @Test
    void identicalSnapshotsHaveNoDiff() {
        QuestionSnapshot a = QuestionVersionService.snapshotOf(mcq(1, "Same", true));
        assertTrue(QuestionVersionService.diff(a, a).isEmpty());
    }

    @Test
    void historyOfUnknownOrExamQuestionIsNotFound() {
        when(questions.findById(1L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.history(1L));

        Question copy = mcq(2, "c", true);
        copy.setSourceQuestionId(1L);
        when(questions.findById(2L)).thenReturn(Optional.of(copy));
        assertThrows(ResourceNotFoundException.class, () -> service.history(2L));
    }

    @Test
    void restoreDtoKeepsOnlyOptionIdsThatStillExist() {
        QuestionSnapshot snap = QuestionVersionService.snapshotOf(mcq(1, "Q", true));

        QuestionDTO dto = QuestionRestoreService.toDto(snap, Set.of(10L));

        assertEquals(10L, dto.getOptions().get(0).getId());
        assertNull(dto.getOptions().get(1).getId());
        assertEquals("Q", dto.getContent());
        assertEquals(QuestionType.MULTIPLE_CHOICE, dto.getType());
    }
}
