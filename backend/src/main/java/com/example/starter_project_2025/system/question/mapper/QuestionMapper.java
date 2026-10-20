package com.example.starter_project_2025.system.question.mapper;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
            od.setImageUrl(o.getImageUrl());
            od.setImageUrl(o.getImageUrl());
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
            Map<Long, QuestionOption> existing = new HashMap<>();
            q.getOptions().forEach(o -> existing.put(o.getId(), o));

            List<QuestionOption> kept = new ArrayList<>();
            for (QuestionDTO.OptionDTO od : d.getOptions()) {
                QuestionOption o = od.getId() == null ? null : existing.get(od.getId());
                if (o == null) {
                    o = new QuestionOption();
                    o.setQuestion(q);
                    q.getOptions().add(o);
                }
                o.setContent(od.getContent().trim());
                o.setCorrect(od.isCorrect());
                o.setImageUrl(od.getImageUrl() == null || od.getImageUrl().isBlank() ? null : od.getImageUrl().trim());
                o.setImageUrl(od.getImageUrl() == null || od.getImageUrl().isBlank() ? null : od.getImageUrl().trim());
                kept.add(o);
            }
            q.getOptions().removeIf(o -> kept.stream().noneMatch(k -> k == o)); // orphanRemoval xóa đáp án không còn
        }
    }
}