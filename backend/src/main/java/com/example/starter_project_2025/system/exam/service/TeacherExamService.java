package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.mapper.ExamMapper;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional
public class TeacherExamService {

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final ExamMapper examMapper;

    public ExamDTO createForTeacher(ExamDTO request) {
        Exam exam = examMapper.toEntity(request);

        ValidationContext context = new ValidationContext();
        if (request.getQuestionIds() != null) {
            exam.setQuestions(resolveQuestions(request.getQuestionIds(), context));
        }

        context.throwIfErrors();

        Exam saved = examRepository.save(exam);
        return examMapper.toResponse(saved);
    }

    private Set<Question> resolveQuestions(List<Long> questionIds, ValidationContext context) {
        Set<Long> uniqueIds = new LinkedHashSet<>();
        if (questionIds == null || questionIds.isEmpty()) {
            context.add("questionIds", "Cần chọn ít nhất một câu hỏi");
            return new LinkedHashSet<>();
        }

        for (Long questionId : questionIds) {
            if (questionId == null) {
                context.add("questionIds", "ID câu hỏi không được để trống");
            } else {
                uniqueIds.add(questionId);
            }
        }

        List<Question> foundQuestions = questionRepository.findAllById(uniqueIds);
        Set<Long> foundIds = new LinkedHashSet<>();
        List<Question> activeQuestions = new ArrayList<>();

        for (Question question : foundQuestions) {
            foundIds.add(question.getId());
            if (Boolean.TRUE.equals(question.getIsActive())) {
                activeQuestions.add(question);
            } else {
                context.add("questionIds", "Không thể thêm câu hỏi đã bị vô hiệu hóa: " + question.getId());
            }
        }

        for (Long questionId : uniqueIds) {
            if (!foundIds.contains(questionId)) {
                context.add("questionIds", "Không tìm thấy câu hỏi: " + questionId);
            }
        }

        return new LinkedHashSet<>(activeQuestions);
    }
}
