package com.example.starter_project_2025.system.exam.service;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.mapper.ExamMapper;
import com.example.starter_project_2025.system.question.domain.Difficulty;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.domain.QuestionType;

@ExtendWith(MockitoExtension.class)
class ExamServiceImplTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private ExamMapper examMapper;

    @InjectMocks
    private ExamServiceImpl examService;

    private Exam exam;
    private Question question;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "teacher@example.com",
                        "password",
                        List.of(new SimpleGrantedAuthority("EXAM_UPDATE"))
                )
        );

        exam = new Exam();
        exam.setId(1L);

        question = new Question();
        question.setId(10L);
        question.setIsActive(true);
        question.setContent("Question content");
        question.setType(QuestionType.SINGLE_CHOICE);
        question.setDifficulty(Difficulty.EASY);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void addQuestionsDeduplicatesIdsAndReturnsUpdatedExam() {
        ExamDTO response = new ExamDTO();
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(questionRepository.findAllById(any())).thenReturn(List.of(question));
        when(examRepository.save(exam)).thenReturn(exam);
        when(examMapper.toResponse(exam)).thenReturn(response);

        ExamDTO result = examService.addQuestions(1L, List.of(10L, 10L));

        assertSame(response, result);
        assertEquals(Set.of(question), exam.getQuestions());
        verify(examRepository).save(exam);
    }

    @Test
    void addQuestionsRejectsUnknownIdsWithoutSavingPartialChanges() {
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(questionRepository.findAllById(any())).thenReturn(List.of(question));

        assertThrows(
                BusinessValidationException.class,
                () -> examService.addQuestions(1L, List.of(10L, 999L))
        );

        assertEquals(Set.of(), exam.getQuestions());
        verify(examRepository, never()).save(any(Exam.class));
    }
}