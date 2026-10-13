package com.example.starter_project_2025.system.question.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.dto.QuestionDTO.OptionDTO;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class QuestionValidator {

    // ===== P1 =====
    public void validateForCreate(QuestionDTO r, ValidationContext ctx) {
        if (r.getOptions() == null) {
            ctx.add("options", "Cần cung cấp danh sách đáp án");
            return;
        }
        validateOptions(r.getType(), r.getOptions(), ctx);
    }

    // ===== P3 =====
    public void validateForUpdate(Question existing, QuestionDTO r, ValidationContext ctx) {
        QuestionType type = r.getType() != null ? r.getType() : existing.getType();
        List<OptionDTO> options = r.getOptions();

        if (options == null) {
            if (r.getType() == null) return;   // không đổi loại, không đổi đáp án
            options = existing.getOptions().stream().map(o -> {
                OptionDTO d = new OptionDTO();
                d.setContent(o.getContent());
                d.setCorrect(o.isCorrect());
                return d;
            }).toList();
        }
        validateOptions(type, options, ctx);
    }

    // ===== Dùng chung =====
    private void validateOptions(QuestionType type, List<OptionDTO> options, ValidationContext ctx) {
        if (options.size() < 2 || options.size() > 6) {
            ctx.add("options", "Số đáp án phải từ 2 đến 6");
        }

        Set<String> seen = new HashSet<>();
        for (OptionDTO o : options) {
            String c = o.getContent() == null ? "" : o.getContent().trim().toLowerCase();
            if (c.isEmpty()) ctx.add("options", "Đáp án không được để trống");
            else if (!seen.add(c)) ctx.add("options", "Các đáp án không được trùng nhau");
        }

        long correct = options.stream().filter(OptionDTO::isCorrect).count();
        if (type == QuestionType.SINGLE_CHOICE && correct != 1)
            ctx.add("options", "Câu 1 đáp án phải có đúng 1 đáp án đúng");
        if (type == QuestionType.MULTI_CHOICE && correct < 1)
            ctx.add("options", "Cần ít nhất 1 đáp án đúng");
    }
}