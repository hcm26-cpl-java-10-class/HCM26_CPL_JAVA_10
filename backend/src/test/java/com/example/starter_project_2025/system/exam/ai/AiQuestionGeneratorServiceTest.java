package com.example.starter_project_2025.system.exam.ai;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.grading.domain.ExamQuestionGradingConfigRepository;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.core.domain.ExamType;
import com.example.starter_project_2025.system.exam.core.service.ExamServiceImpl;
import com.example.starter_project_2025.system.question.core.domain.Difficulty;
import com.example.starter_project_2025.system.question.core.domain.Question;
import com.example.starter_project_2025.system.question.core.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;
import com.example.starter_project_2025.system.question.core.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.core.mapper.QuestionMapper;
import com.example.starter_project_2025.system.question.core.service.QuestionServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import com.example.starter_project_2025.system.exam.ai.AiQuestionGeneratorDTO.*;

@ExtendWith(MockitoExtension.class)
class AiQuestionGeneratorServiceTest {

    @Mock
    private AiGradingProperties properties;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamServiceImpl examService;

    @Mock
    private QuestionServiceImpl questionService;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private QuestionMapper questionMapper;

    @Mock
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private ExamQuestionGradingConfigRepository gradingConfigRepository;

    @InjectMocks
    private AiQuestionGeneratorService generatorService;

    @BeforeEach
    void setUp() {
        lenient().when(properties.isEnabled()).thenReturn(true);
        lenient().when(properties.getModel()).thenReturn("gemini-3.5-flash-lite");
        lenient().when(properties.getTimeoutSeconds()).thenReturn(30);
    }

    @Test
    @DisplayName("getStatus: returns FALLBACK when API key is not configured")
    void getStatus_unconfigured() {
        when(properties.getApiKey()).thenReturn(null);

        GeneratorStatusResponse status = generatorService.getStatus();

        assertThat(status.isEnabled()).isTrue();
        assertThat(status.isConfigured()).isFalse();
        assertThat(status.getProvider()).isEqualTo("FALLBACK");
        assertThat(status.getModel()).contains("Fallback");
    }

    @Test
    @DisplayName("getStatus: returns GEMINI when API key is present")
    void getStatus_configured() {
        when(properties.getApiKey()).thenReturn("AIzaSyDummyKey");

        GeneratorStatusResponse status = generatorService.getStatus();

        assertThat(status.isEnabled()).isTrue();
        assertThat(status.isConfigured()).isTrue();
        assertThat(status.getProvider()).isEqualTo("GEMINI");
        assertThat(status.getModel()).isEqualTo("gemini-3.5-flash-lite");
    }

    @Test
    @DisplayName("generateQuestions: throws BadRequestException when prompt and document are both empty")
    void generateQuestions_emptyInputs() {
        GenerateRequest req = GenerateRequest.builder()
                .mode("PROMPT")
                .prompt("")
                .documentContent(null)
                .requests(List.of(
                        QuestionTypeRequestItem.builder().type(QuestionType.MULTIPLE_CHOICE).count(2).build()
                ))
                .build();

        assertThatThrownBy(() -> generatorService.generateQuestions(req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("cung cấp mô tả yêu cầu hoặc nội dung tài liệu");
    }

    @Test
    @DisplayName("generateQuestions: throws BadRequestException when count exceeds limit")
    void generateQuestions_exceedLimit() {
        GenerateRequest req = GenerateRequest.builder()
                .mode("PROMPT")
                .prompt("Generate 50 questions")
                .requests(List.of(
                        QuestionTypeRequestItem.builder().type(QuestionType.MULTIPLE_CHOICE).count(35).build()
                ))
                .build();

        assertThatThrownBy(() -> generatorService.generateQuestions(req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("từ 1 đến 30 câu");
    }

    @Test
    @DisplayName("generateQuestions: generates multiple choice, essay and coding in fallback mode")
    void generateQuestions_fallbackMultiType() {
        when(properties.getApiKey()).thenReturn(null); // Force fallback

        GenerateRequest req = GenerateRequest.builder()
                .mode("PROMPT")
                .prompt("Kiến trúc phần mềm Clean Architecture và OOP")
                .topic("Clean Architecture")
                .requests(List.of(
                        QuestionTypeRequestItem.builder().type(QuestionType.MULTIPLE_CHOICE).count(2).difficulty(Difficulty.MEDIUM).points(1).build(),
                        QuestionTypeRequestItem.builder().type(QuestionType.ESSAY).count(1).difficulty(Difficulty.HARD).points(10).build(),
                        QuestionTypeRequestItem.builder().type(QuestionType.CODING).count(1).difficulty(Difficulty.MEDIUM).points(10).build()
                ))
                .build();

        GenerateResponse res = generatorService.generateQuestions(req);

        assertThat(res.isFallback()).isTrue();
        assertThat(res.getProvider()).isEqualTo("FALLBACK");
        assertThat(res.getQuestions()).hasSize(4);

        // Multiple choice validation
        GeneratedQuestion mc = res.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.MULTIPLE_CHOICE)
                .findFirst().orElseThrow();
        assertThat(mc.getOptions()).hasSize(4);
        assertThat(mc.getOptions().stream().filter(OptionItem::isCorrect)).hasSize(1);
        assertThat(mc.getExplanation()).isNotBlank();

        // Essay validation
        GeneratedQuestion essay = res.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.ESSAY)
                .findFirst().orElseThrow();
        assertThat(essay.getReferenceAnswer()).isNotBlank();
        assertThat(essay.getRubric()).isNotBlank();
        assertThat(essay.getGradingCriteria()).isNotEmpty();
        int totalWeight = essay.getGradingCriteria().stream().mapToInt(GradingCriterionItem::getWeightPercentage).sum();
        assertThat(totalWeight).isEqualTo(100);

        // Coding validation
        GeneratedQuestion coding = res.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.CODING)
                .findFirst().orElseThrow();
        assertThat(coding.getCode()).isNotNull();
        assertThat(coding.getCode().getFunctionName()).isEqualTo("findMaximumSubarraySum");
        assertThat(coding.getCode().getTests()).isNotEmpty();
    }

    @Test
    @DisplayName("regenerateSingle: updates question content and parameters")
    void regenerateSingle_success() {
        when(properties.getApiKey()).thenReturn(null);

        GeneratedQuestion original = GeneratedQuestion.builder()
                .tempId("q_1")
                .type(QuestionType.MULTIPLE_CHOICE)
                .difficulty(Difficulty.EASY)
                .points(2)
                .topic("Java Basics")
                .content("Original question")
                .build();

        RegenerateSingleRequest req = RegenerateSingleRequest.builder()
                .question(original)
                .instruction("Thêm ví dụ thực tế")
                .topic("Java Basics")
                .build();

        GeneratedQuestion refreshed = generatorService.regenerateSingle(req);

        assertThat(refreshed.getTempId()).isEqualTo("q_1");
        assertThat(refreshed.getContent()).contains("Đã điều chỉnh theo yêu cầu: Thêm ví dụ thực tế");
    }

    @Test
    @DisplayName("commitToExam: creates questions in bank and links them to exam")
    void commitToExam_success() {
        Exam exam = new Exam();
        exam.setId(70L);
        exam.setTitle("Midterm Assessment");
        when(examService.getExamForPoolConfiguration(70L)).thenReturn(exam);

        GeneratedQuestion gq1 = GeneratedQuestion.builder()
                .tempId("q_1")
                .type(QuestionType.MULTIPLE_CHOICE)
                .difficulty(Difficulty.MEDIUM)
                .points(1)
                .topic("Java")
                .content("MC question")
                .options(List.of(
                        new OptionItem("Option A", true),
                        new OptionItem("Option B", false)
                ))
                .build();

        GeneratedQuestion gq2 = GeneratedQuestion.builder()
                .tempId("q_2")
                .type(QuestionType.ESSAY)
                .difficulty(Difficulty.HARD)
                .points(10)
                .topic("Java")
                .content("Essay question")
                .referenceAnswer("Sample model answer")
                .rubric("Rubric description")
                .build();

        QuestionDTO createdDto1 = new QuestionDTO();
        createdDto1.setId(101L);
        QuestionDTO createdDto2 = new QuestionDTO();
        createdDto2.setId(102L);

        when(questionService.create(any(QuestionDTO.class)))
                .thenReturn(createdDto1)
                .thenReturn(createdDto2);

        CommitToExamRequest req = CommitToExamRequest.builder()
                .examId(70L)
                .questions(List.of(gq1, gq2))
                .build();

        CommitToExamResponse response = generatorService.commitToExam(req);

        assertThat(response.getExamId()).isEqualTo(70L);
        assertThat(response.getAddedCount()).isEqualTo(2);
        assertThat(response.getQuestionIds()).containsExactly(101L, 102L);

        verify(examService).addQuestions(eq(70L), eq(List.of(101L, 102L)));
        verify(gradingConfigRepository).save(any());
    }

    @Test
    @DisplayName("getExamAiQuestions returns AI questions for this exam")
    void getExamAiQuestions_success() {
        Exam exam = new Exam();
        exam.setId(70L);
        when(examService.getExamForPoolConfiguration(70L)).thenReturn(exam);
        when(examAttemptRepository.existsByExam_Id(70L)).thenReturn(false);

        Question q = new Question();
        q.setId(101L);
        q.setExamId(70L);
        q.setSource("AI_GENERATED");
        when(questionRepository.findByExamIdAndSource(70L, "AI_GENERATED")).thenReturn(List.of(q));

        QuestionDTO dto = new QuestionDTO();
        dto.setId(101L);
        dto.setSource("AI_GENERATED");
        when(questionMapper.toResponse(q)).thenReturn(dto);

        List<QuestionDTO> result = generatorService.getExamAiQuestions(70L);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo(101L);
    }

    @Test
    @DisplayName("deleteAiQuestionPermanently removes question completely")
    void deleteAiQuestionPermanently_success() {
        Exam exam = new Exam();
        exam.setId(70L);
        Question q = new Question();
        q.setId(101L);
        q.setExamId(70L);
        q.setSource("AI_GENERATED");
        exam.getQuestions().add(q);

        when(examService.getExamForPoolConfiguration(70L)).thenReturn(exam);
        when(examAttemptRepository.existsByExam_Id(70L)).thenReturn(false);
        when(questionRepository.findById(101L)).thenReturn(Optional.of(q));

        generatorService.deleteAiQuestionPermanently(70L, 101L);

        verify(gradingConfigRepository).deleteByExamIdAndQuestionId(70L, 101L);
        verify(questionRepository).delete(q);
        verify(examRepository).save(exam);
    }

    @Test
    @DisplayName("generateQuestions: rejects request when question type is not allowed for exam")
    void generateQuestions_rejectsDisallowedType() {
        Exam exam = new Exam();
        exam.setId(70L);
        exam.setExamType(ExamType.MULTIPLE_CHOICE);
        when(examRepository.findById(70L)).thenReturn(Optional.of(exam));

        GenerateRequest req = GenerateRequest.builder()
                .examId(70L)
                .prompt("Generate coding questions")
                .requests(List.of(
                        new QuestionTypeRequestItem(QuestionType.CODING, 1, Difficulty.MEDIUM, 10)
                ))
                .build();

        assertThatThrownBy(() -> generatorService.generateQuestions(req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("CODING");
    }

    @Test
    @DisplayName("commitToExam: rejects commit when question type is not allowed for exam")
    void commitToExam_rejectsDisallowedType() {
        Exam exam = new Exam();
        exam.setId(70L);
        exam.setExamType(ExamType.CODING);
        when(examService.getExamForPoolConfiguration(70L)).thenReturn(exam);

        GeneratedQuestion mcQuestion = GeneratedQuestion.builder()
                .tempId("q_1")
                .type(QuestionType.MULTIPLE_CHOICE)
                .difficulty(Difficulty.EASY)
                .points(1)
                .content("Disallowed MCQ")
                .build();

        CommitToExamRequest req = CommitToExamRequest.builder()
                .examId(70L)
                .questions(List.of(mcQuestion))
                .build();

        assertThatThrownBy(() -> generatorService.commitToExam(req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("MULTIPLE_CHOICE");
    }
}
