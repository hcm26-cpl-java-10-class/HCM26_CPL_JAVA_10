package com.example.starter_project_2025.system.question.service;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.dto.QuestionFilter;
import com.example.starter_project_2025.system.question.mapper.QuestionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class QuestionServiceImpl
        extends BaseCrudServiceImpl<Question, Long, QuestionDTO, QuestionFilter> {

    private final QuestionRepository repository;
    private final QuestionMapper mapper;
    private final QuestionValidator validator;
    private final ExamRepository examRepository;

    @Override
    protected BaseCrudRepository<Question, Long> getRepository() { return repository; }

    @Override
    protected BaseCrudMapper<Question, QuestionDTO> getMapper() { return mapper; }

    @Override
    protected String[] searchableFields() { return new String[]{"content", "topic"}; }

    @Override
    protected void beforeCreate(Question entity, QuestionDTO request, ValidationContext ctx) {
        entity.setIsActive(true);
        validator.validateForCreate(request, ctx);
    }

    @Override
    protected void beforeUpdate(Question entity, QuestionDTO request, ValidationContext ctx) {
        rejectExamCopy(entity);
        boolean inUse = examRepository.existsByQuestions_Id(entity.getId());
        validator.validateForUpdate(entity, request, inUse, ctx);
    }

    private void rejectExamCopy(Question entity) {
        if (entity.getSourceQuestionId() != null) {
            throw new BadRequestException("Câu hỏi này là bản sao thuộc một đề thi, hãy sửa hoặc xóa trong đề thi");
        }
    }

    @Override
    protected void beforeDelete(Question entity) {
        rejectExamCopy(entity);
        if (examRepository.existsByQuestions_Id(entity.getId())) {
            ValidationContext ctx = new ValidationContext();
            ctx.add("question", "Câu hỏi đang được dùng trong đề thi, không thể xóa. ");
            ctx.throwIfErrors();
        }
    }
}