package com.example.starter_project_2025.system.question.mapper;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import org.springframework.stereotype.Component;

@Component
public class QuestionMapper implements BaseCrudMapper<Question, QuestionDTO> {

    @Override
    public Question toEntity(QuestionDTO dto) {
        Question q = new Question();
        q.setIsActive(dto.getIsActive() == null ? Boolean.TRUE : dto.getIsActive());
        apply(q, dto);
        return q;
    }

    @Override
    public QuestionDTO toResponse(Question q) {
        QuestionDTO d = new QuestionDTO();
        d.setId(q.getId());
        d.setIsActive(q.getIsActive());
        d.setCreatedAt(q.getCreatedAt());
        d.setUpdatedAt(q.getUpdatedAt());
        d.setCreatedBy(q.getCreatedBy());
        d.setUpdatedBy(q.getUpdatedBy());
        d.setContent(q.getContent());
        d.setType(q.getType());
        d.setDifficulty(q.getDifficulty());
        d.setTopic(q.getTopic());
        d.setPoints(q.getPoints());
        d.setOptions(q.getOptions().stream().map(o -> {
            QuestionDTO.OptionDTO od = new QuestionDTO.OptionDTO();
            od.setId(o.getId());
            od.setContent(o.getContent());
            od.setCorrect(o.isCorrect());
            return od;
        }).toList());
        return d;
    }

    @Override
    public void update(Question q, QuestionDTO dto) {
        if (dto.getIsActive() != null) q.setIsActive(dto.getIsActive());
        apply(q, dto);
    }

    private void apply(Question q, QuestionDTO d) {
        if (d.getContent() != null) q.setContent(d.getContent().trim());
        if (d.getType() != null) q.setType(d.getType());
        if (d.getDifficulty() != null) q.setDifficulty(d.getDifficulty());
        if (d.getTopic() != null) {
            q.setTopic(d.getTopic().isBlank() ? null : d.getTopic().trim().toLowerCase());
        }
        if (d.getPoints() != null) q.setPoints(d.getPoints());

        if (q.getType() == QuestionType.ESSAY) {
            q.getOptions().clear();
        } else if (d.getOptions() != null) {
            q.getOptions().clear();               // orphanRemoval sẽ xóa đáp án cũ
            for (QuestionDTO.OptionDTO od : d.getOptions()) {
                QuestionOption o = new QuestionOption();
                o.setContent(od.getContent().trim());
                o.setCorrect(od.isCorrect());
                o.setQuestion(q);
                q.getOptions().add(o);
            }
        }
    }
}