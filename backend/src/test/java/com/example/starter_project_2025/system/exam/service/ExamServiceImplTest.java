package com.example.starter_project_2025.system.exam.service;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
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
import com.example.starter_project_2025.system.question.domain.EssayGradingCriterion;
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
        question.setType(QuestionType.MULTIPLE_CHOICE);
        question.setDifficulty(Difficulty.EASY);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void addQuestionsClonesBankQuestionsAndLeavesOriginalUntouched() {
        ExamDTO response = new ExamDTO();
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(questionRepository.findAllById(any())).thenReturn(List.of(question));
        when(examRepository.save(exam)).thenReturn(exam);
        when(examMapper.toResponse(exam)).thenReturn(response);
        when(questionRepository.save(any(Question.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ExamDTO result = examService.addQuestions(1L, List.of(10L, 10L));

        assertSame(response, result);
        assertEquals(1, exam.getQuestions().size());

        Question copy = exam.getQuestions().iterator().next();
        assertNotSame(question, copy);
        assertEquals(10L, copy.getSourceQuestionId());
        assertEquals("Question content", copy.getContent());
        assertNull(question.getSourceQuestionId());

        verify(examRepository).save(exam);
    }

    @Test
    void addQuestionsCopiesEssayGradingCriteriaIndependently() {
        question.setType(QuestionType.ESSAY);
        EssayGradingCriterion sourceCriterion = new EssayGradingCriterion();
        sourceCriterion.setName("Correctness");
        sourceCriterion.setDescription("Core concepts are correct");
        sourceCriterion.setWeightPercentage(100);
        question.getGradingCriteria().add(sourceCriterion);

        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(questionRepository.findAllById(any())).thenReturn(List.of(question));
        when(examRepository.save(exam)).thenReturn(exam);
        when(examMapper.toResponse(exam)).thenReturn(new ExamDTO());
        when(questionRepository.save(any(Question.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        examService.addQuestions(1L, List.of(10L));

        Question copy = exam.getQuestions().iterator().next();
        assertEquals(1, copy.getGradingCriteria().size());
        assertNotSame(sourceCriterion, copy.getGradingCriteria().get(0));
        assertEquals("Correctness", copy.getGradingCriteria().get(0).getName());
        assertEquals(100, copy.getGradingCriteria().get(0).getWeightPercentage());
    }

    @Test
    void addQuestionsRejectsUnknownIdsWithoutSavingPartialChanges() {
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(questionRepository.findAllById(any())).thenReturn(List.of(question));

        assertThrows(
                BusinessValidationException.class,
                () -> examService.addQuestions(1L, List.of(10L, 999L))
        );

        assertEquals(0, exam.getQuestions().size());
        verify(examRepository, never()).save(any(Exam.class));
    }
}