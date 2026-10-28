package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.ExamTemplate;
import com.example.starter_project_2025.system.exam.domain.ExamTemplateQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamTemplateQuestionOption;
import com.example.starter_project_2025.system.exam.domain.ExamTemplateRepository;
import com.example.starter_project_2025.system.exam.dto.CreateExamFromTemplateRequest;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamTemplateDTO;
import com.example.starter_project_2025.system.exam.dto.SaveExamTemplateRequest;
import com.example.starter_project_2025.system.exam.dto.UpdateExamTemplateRequest;
import com.example.starter_project_2025.system.exam.mapper.ExamMapper;
import com.example.starter_project_2025.system.question.domain.Difficulty;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExamTemplateServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamTemplateRepository templateRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private ExamMapper examMapper;

    private ExamTemplateService service;

    @BeforeEach
    void setUp() {
        service = new ExamTemplateService(
                examRepository,
                templateRepository,
                questionRepository,
                examMapper
        );
    }

    @Test
    @DisplayName("saveAsTemplate: Lưu đề thi thành đề thi mẫu thành công")
    void saveAsTemplate_Success() {
        Exam exam = new Exam();
        exam.setId(100L);
        exam.setDurationMinutes(60);
        exam.setMaxAttempts(2);
        exam.setPassScore(BigDecimal.valueOf(5.0));

        Question q = new Question();
        q.setId(1L);
        q.setContent("Câu hỏi mẫu?");
        q.setType(QuestionType.MULTIPLE_CHOICE);
        q.setDifficulty(Difficulty.EASY);
        q.setPoints(1);

        QuestionOption opt = new QuestionOption();
        opt.setId(11L);
        opt.setContent("Đáp án A");
        opt.setCorrect(true);
        q.getOptions().add(opt);

        exam.setQuestions(new LinkedHashSet<>(Set.of(q)));

        when(examRepository.findById(100L)).thenReturn(Optional.of(exam));
        when(templateRepository.save(any(ExamTemplate.class))).thenAnswer(invocation -> {
            ExamTemplate t = invocation.getArgument(0);
            t.setId(1L);
            return t;
        });

        SaveExamTemplateRequest request = new SaveExamTemplateRequest();
        request.setName("Đề mẫu giữa kỳ");
        request.setDescription("Mô tả đề mẫu");

        ExamTemplateDTO result = service.saveAsTemplate(100L, request);

        assertNotNull(result);
        assertEquals("Đề mẫu giữa kỳ", result.getName());
        assertEquals("Mô tả đề mẫu", result.getDescription());
        assertEquals(60, result.getDurationMinutes());
        assertEquals(1, result.getQuestionCount());
        verify(templateRepository).save(any(ExamTemplate.class));
    }

    @Test
    @DisplayName("saveAsTemplate: Ném ResourceNotFoundException khi không tìm thấy exam")
    void saveAsTemplate_ExamNotFound() {
        when(examRepository.findById(999L)).thenReturn(Optional.empty());

        SaveExamTemplateRequest request = new SaveExamTemplateRequest();
        request.setName("Đề mẫu");

        assertThrows(ResourceNotFoundException.class, () -> service.saveAsTemplate(999L, request));
    }

    @Test
    @DisplayName("createExamFromTemplate: Tạo đề thi mới từ template thành công")
    void createExamFromTemplate_Success() {
        ExamTemplate template = new ExamTemplate();
        template.setId(5L);
        template.setName("Template mẫu");
        template.setDurationMinutes(45);
        template.setMaxAttempts(1);

        ExamTemplateQuestion tq = new ExamTemplateQuestion();
        tq.setId(10L);
        tq.setContent("Nội dung snapshot");
        tq.setType(QuestionType.MULTIPLE_CHOICE);
        tq.setDifficulty(Difficulty.MEDIUM);
        tq.setPosition(0);
        tq.setPoints(2);

        ExamTemplateQuestionOption topt = new ExamTemplateQuestionOption();
        topt.setId(20L);
        topt.setContent("Lựa chọn 1");
        topt.setCorrect(true);
        topt.setPosition(0);
        tq.getOptions().add(topt);

        template.getQuestions().add(tq);

        when(templateRepository.findById(5L)).thenReturn(Optional.of(template));
        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Exam savedExam = new Exam();
        savedExam.setId(200L);
        savedExam.setTitle("Bài thi mới từ template");
        when(examRepository.save(any(Exam.class))).thenReturn(savedExam);

        ExamDTO expectedDto = new ExamDTO();
        expectedDto.setId(200L);
        expectedDto.setTitle("Bài thi mới từ template");
        when(examMapper.toResponse(savedExam)).thenReturn(expectedDto);

        CreateExamFromTemplateRequest request = new CreateExamFromTemplateRequest();
        request.setTitle("Bài thi mới từ template");
        request.setStartTime(LocalDateTime.now());
        request.setEndTime(LocalDateTime.now().plusHours(1));

        ExamDTO result = service.createExamFromTemplate(5L, request);

        assertNotNull(result);
        assertEquals(200L, result.getId());
        assertEquals("Bài thi mới từ template", result.getTitle());

        ArgumentCaptor<Exam> examCaptor = ArgumentCaptor.forClass(Exam.class);
        verify(examRepository).save(examCaptor.capture());
        Exam capturedExam = examCaptor.getValue();
        assertEquals("Bài thi mới từ template", capturedExam.getTitle());
        assertEquals(45, capturedExam.getDurationMinutes());
        assertEquals(1, capturedExam.getQuestions().size());
    }

    @Test
    @DisplayName("listTemplates: Lấy danh sách template")
    void listTemplates_Success() {
        ExamTemplate t = new ExamTemplate();
        t.setId(1L);
        t.setName("Template 1");
        t.setDurationMinutes(30);

        when(templateRepository.findAll()).thenReturn(List.of(t));

        List<ExamTemplateDTO> list = service.listTemplates();
        assertEquals(1, list.size());
        assertEquals("Template 1", list.get(0).getName());
    }

    @Test
    @DisplayName("updateTemplate: Cập nhật thông tin template thành công")
    void updateTemplate_Success() {
        ExamTemplate template = new ExamTemplate();
        template.setId(1L);
        template.setName("Tên cũ");
        template.setDescription("Mô tả cũ");
        template.setDurationMinutes(45);
        template.setMaxAttempts(1);

        when(templateRepository.findById(1L)).thenReturn(Optional.of(template));
        when(templateRepository.save(any(ExamTemplate.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateExamTemplateRequest request = new UpdateExamTemplateRequest();
        request.setName("Tên mới");
        request.setDescription("Mô tả mới");
        request.setDurationMinutes(90);
        request.setMaxAttempts(2);

        ExamTemplateDTO updated = service.updateTemplate(1L, request);

        assertNotNull(updated);
        assertEquals("Tên mới", updated.getName());
        assertEquals("Mô tả mới", updated.getDescription());
        assertEquals(90, updated.getDurationMinutes());
        assertEquals(2, updated.getMaxAttempts());
    }

    @Test
    @DisplayName("updateTemplate: Ném ResourceNotFoundException khi không tìm thấy template")
    void updateTemplate_NotFound() {
        when(templateRepository.findById(99L)).thenReturn(Optional.empty());

        UpdateExamTemplateRequest request = new UpdateExamTemplateRequest();
        request.setName("Tên mới");

        assertThrows(ResourceNotFoundException.class, () -> service.updateTemplate(99L, request));
    }

    @Test
    @DisplayName("deleteTemplate: Xóa template thành công")
    void deleteTemplate_Success() {
        ExamTemplate template = new ExamTemplate();
        template.setId(1L);
        when(templateRepository.findById(1L)).thenReturn(Optional.of(template));

        service.deleteTemplate(1L);
        verify(templateRepository).delete(template);
    }
}
