package com.example.starter_project_2025.system.question.mapper;

import com.example.starter_project_2025.system.exam.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.dto.QuestionTakerDTO;
import org.springframework.stereotype.Component;

@Component
public class QuestionTakerMapper {

    public QuestionTakerDTO toTakerResponse(Question q) {
        QuestionTakerDTO d = new QuestionTakerDTO();
        d.setId(q.getId());
        d.setContent(q.getContent());
        d.setType(q.getType());
        d.setPoints(q.getPoints());
        d.setOptions(q.getOptions().stream().map(o -> {
            QuestionTakerDTO.OptionTakerDTO od = new QuestionTakerDTO.OptionTakerDTO();
            od.setId(o.getId());
            od.setContent(o.getContent());
            return od;
        }).toList());
        return d;
    }

    public QuestionTakerDTO toTakerResponse(ExamAttemptQuestion q) {
        QuestionTakerDTO d = new QuestionTakerDTO();
        d.setId(q.getSourceQuestionId());
        d.setContent(q.getContent());
        d.setType(q.getType());
        d.setPoints(q.getPoints());
        d.setOptions(q.getOptions().stream().map(o -> {
            QuestionTakerDTO.OptionTakerDTO od = new QuestionTakerDTO.OptionTakerDTO();
            od.setId(o.getSourceOptionId());
            od.setContent(o.getContent());
            return od;
        }).toList());
        return d;
    }
}