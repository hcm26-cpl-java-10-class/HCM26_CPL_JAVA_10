package com.example.starter_project_2025.system.question.core.mapper;

import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.question.core.domain.Question;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;
import com.example.starter_project_2025.system.question.core.dto.QuestionTakerDTO;
import com.example.starter_project_2025.system.question.core.service.CodeSpecSupport;
import org.springframework.stereotype.Component;

@Component
public class QuestionTakerMapper {

    public QuestionTakerDTO toTakerResponse(Question q) {
        QuestionTakerDTO d = new QuestionTakerDTO();
        d.setId(q.getId());
        d.setContent(q.getContent());
        d.setImageUrl(q.getImageUrl());
        d.setType(q.getType());
        d.setPoints(q.getPoints());
        d.setCode(q.getType() == QuestionType.CODING ? CodeSpecSupport.forTaker(q.getCodeSpec()) : null);
        d.setMultiSelect(q.getOptions().stream().filter(o -> o.isCorrect()).count() > 1);
        d.setOptions(q.getOptions().stream().map(o -> {
            QuestionTakerDTO.OptionTakerDTO od = new QuestionTakerDTO.OptionTakerDTO();
            od.setId(o.getId());
            od.setContent(o.getContent());
            od.setImageUrl(o.getImageUrl());
            return od;
        }).toList());
        return d;
    }

    public QuestionTakerDTO toTakerResponse(ExamAttemptQuestion q) {
        QuestionTakerDTO d = new QuestionTakerDTO();
        d.setId(q.getSourceQuestionId());
        d.setContent(q.getContent());
        d.setImageUrl(q.getImageUrl());
        d.setType(q.getType());
        d.setPoints(q.getPoints());
        d.setCode(q.getType() == QuestionType.CODING ? CodeSpecSupport.forTaker(q.getCodeSpec()) : null);
        d.setMultiSelect(q.getOptions().stream().filter(o -> o.isCorrect()).count() > 1);
        d.setOptions(q.getOptions().stream().map(o -> {
            QuestionTakerDTO.OptionTakerDTO od = new QuestionTakerDTO.OptionTakerDTO();
            od.setId(o.getSourceOptionId());
            od.setContent(o.getContent());
            od.setImageUrl(o.getImageUrl());
            return od;
        }).toList());
        return d;
    }
}