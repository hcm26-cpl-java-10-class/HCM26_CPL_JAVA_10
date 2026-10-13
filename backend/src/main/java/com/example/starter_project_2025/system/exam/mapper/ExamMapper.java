package com.example.starter_project_2025.system.exam.mapper;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.mapper.QuestionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Component
@RequiredArgsConstructor
public class ExamMapper implements BaseCrudMapper<Exam, ExamDTO> {

    private final QuestionMapper questionMapper;

    @Override
    public Exam toEntity(ExamDTO dto) {
        Exam e = new Exam();
        e.setIsActive(dto.getIsActive() == null ? Boolean.TRUE : dto.getIsActive());
        apply(e, dto);
        return e;
    }

    @Override
    public ExamDTO toResponse(Exam e) {
        ExamDTO d = new ExamDTO();
        d.setId(e.getId());
        d.setIsActive(e.getIsActive());
        d.setCreatedAt(e.getCreatedAt());
        d.setUpdatedAt(e.getUpdatedAt());
        d.setCreatedBy(e.getCreatedBy());
        d.setUpdatedBy(e.getUpdatedBy());
        d.setTitle(e.getTitle());
        d.setDurationMinutes(e.getDurationMinutes());

        List<Question> sorted = e.getQuestions().stream()
                .sorted(Comparator.comparing(Question::getId)).toList();
        d.setQuestionIds(sorted.stream().map(Question::getId).toList());
        d.setQuestions(sorted.stream().map(questionMapper::toResponse).toList());
        d.setTotalPoints(sorted.stream().mapToInt(Question::getPoints).sum());
        return d;
    }

    @Override
    public void update(Exam e, ExamDTO dto) {
        if (dto.getIsActive() != null) e.setIsActive(dto.getIsActive());
        apply(e, dto);
    }

    private void apply(Exam e, ExamDTO d) {
        if (d.getTitle() != null) e.setTitle(d.getTitle().trim());
        if (d.getDurationMinutes() != null) e.setDurationMinutes(d.getDurationMinutes());
    }
}