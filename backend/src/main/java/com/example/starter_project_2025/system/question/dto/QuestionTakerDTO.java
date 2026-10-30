package com.example.starter_project_2025.system.question.dto;

import com.example.starter_project_2025.system.question.domain.QuestionType;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter @Setter
public class QuestionTakerDTO {
    private Long id;
    private String content;
    private QuestionType type;
    private int points;
    private String imageUrl;
    private boolean multiSelect;
    private List<OptionTakerDTO> options;
    /** Chi co voi cau lap trinh; khong chua test an. */
    private CodeSpecDTO code;

    @Getter @Setter
    public static class OptionTakerDTO {
        private Long id;
        private String content;
        private String imageUrl;
    }
}