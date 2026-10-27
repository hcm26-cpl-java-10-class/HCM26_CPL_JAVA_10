package com.example.starter_project_2025.system.question.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.QuestionDTO.EssayCriterionDTO;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.dto.QuestionDTO.OptionDTO;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
public class QuestionValidator {

    public void validateForCreate(QuestionDTO r, ValidationContext ctx) {
        validateGradingCriteria(r.getType(), r.getGradingCriteria(), ctx);
        if (r.getType() == QuestionType.ESSAY) {
            rejectOptionsForEssay(r.getOptions(), ctx);
            return;
        }

        if (r.getOptions() == null) {
            ctx.add("options", "Cần cung cấp danh sách đáp án");
            return;
        }
        validateOptions(r.getType(), r.getOptions(), ctx);
    }

    public void validateForUpdate(Question existing, QuestionDTO r, boolean inUse, ValidationContext ctx) {
        QuestionType type = r.getType() != null ? r.getType() : existing.getType();
        List<OptionDTO> options = r.getOptions();
        validateGradingCriteria(type, r.getGradingCriteria(), ctx);

        if (inUse) {
            if (r.getType() != null && r.getType() != existing.getType()) {
                ctx.add("type", "Câu hỏi đang nằm trong đề thi, không thể đổi loại câu hỏi");
            }

            if (r.getPoints() != null && r.getPoints() != existing.getPoints()) {
                ctx.add("points", "Câu hỏi đang nằm trong đề thi, không thể đổi điểm");
            }
        }

        if (type == QuestionType.ESSAY) {
            rejectOptionsForEssay(options, ctx);
            return;
        }

        if (options != null) {
            validateOptionIds(existing, options, ctx);
            if (inUse && optionsChanged(existing, options)) {
                ctx.add("options", "Câu hỏi đang nằm trong đề thi, không thể sửa đáp án");
            }
        }

        if (options == null) {
            if (r.getType() == null) return;
            options = existing.getOptions().stream().map(o -> {
                OptionDTO d = new OptionDTO();
                d.setContent(o.getContent());
                d.setCorrect(o.isCorrect());
                return d;
            }).toList();
        }
        validateOptions(type, options, ctx);
    }

    private void validateGradingCriteria(
            QuestionType type,
            List<EssayCriterionDTO> criteria,
            ValidationContext ctx
    ) {
        if (criteria == null || criteria.isEmpty()) return;
        if (type != QuestionType.ESSAY) {
            ctx.add("gradingCriteria", "Tiêu chí chấm điểm chỉ áp dụng cho câu tự luận");
            return;
        }
        if (criteria.size() > 20) {
            ctx.add("gradingCriteria", "Tối đa 20 tiêu chí chấm điểm");
        }

        Set<String> names = new HashSet<>();
        int totalWeight = 0;
        for (EssayCriterionDTO criterion : criteria) {
            if (criterion == null) {
                ctx.add("gradingCriteria", "Tiêu chí chấm điểm không được để trống");
                continue;
            }
            String name = criterion.getName() == null ? "" : criterion.getName().trim();
            if (name.isEmpty()) {
                ctx.add("gradingCriteria", "Tên tiêu chí không được để trống");
            } else if (!names.add(name.toLowerCase(Locale.ROOT))) {
                ctx.add("gradingCriteria", "Tên các tiêu chí không được trùng nhau");
            }
            if (criterion.getDescription() != null && criterion.getDescription().trim().length() > 1000) {
                ctx.add("gradingCriteria", "Mô tả tiêu chí tối đa 1000 ký tự");
            }
            Integer weight = criterion.getWeightPercentage();
            if (weight == null || weight < 1 || weight > 100) {
                ctx.add("gradingCriteria", "Tỷ trọng mỗi tiêu chí phải từ 1% đến 100%");
            } else {
                totalWeight += weight;
            }
        }
        if (totalWeight != 100) {
            ctx.add("gradingCriteria", "Tổng tỷ trọng các tiêu chí phải bằng 100%");
        }
    }

    private void validateOptionIds(Question existing, List<OptionDTO> options, ValidationContext ctx) {
        Set<Long> valid = new HashSet<>();
        existing.getOptions().forEach(o -> valid.add(o.getId()));
        Set<Long> used = new HashSet<>();
        for (OptionDTO o : options) {
            if (o.getId() == null) continue;
            if (!valid.contains(o.getId())) {
                ctx.add("options", "Đáp án " + o.getId() + " không thuộc câu hỏi này");
            } else if (!used.add(o.getId())) {
                ctx.add("options", "Đáp án " + o.getId() + " bị lặp");
            }
        }
    }

    private boolean optionsChanged(Question existing, List<OptionDTO> options) {
        if (options.size() != existing.getOptions().size()) return true;
        Map<Long, QuestionOption> byId = new HashMap<>();
        existing.getOptions().forEach(o -> byId.put(o.getId(), o));
        for (OptionDTO d : options) {
            QuestionOption o = d.getId() == null ? null : byId.get(d.getId());
            if (o == null) return true;
            String content = d.getContent() == null ? "" : d.getContent().trim();
            if (!content.equals(o.getContent()) || d.isCorrect() != o.isCorrect()) return true;
        }
        return false;
    }

    private void rejectOptionsForEssay(List<OptionDTO> options, ValidationContext ctx) {
        if (options != null && !options.isEmpty()) {
            ctx.add("options", "Câu tự luận không có đáp án, không gửi danh sách đáp án");
        }
    }

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
        if (correct < 1)

        if (type == QuestionType.MULTIPLE_CHOICE && correct < 1)
            ctx.add("options", "Cần ít nhất 1 đáp án đúng");
    }
}