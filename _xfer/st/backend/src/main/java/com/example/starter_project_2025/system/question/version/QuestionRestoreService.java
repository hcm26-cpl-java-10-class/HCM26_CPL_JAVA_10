package com.example.starter_project_2025.system.question.version;

import com.example.starter_project_2025.system.question.core.domain.Difficulty;
import com.example.starter_project_2025.system.question.core.domain.QuestionOption;
import com.example.starter_project_2025.system.question.core.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;
import com.example.starter_project_2025.system.question.core.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.core.service.CodeSpecSupport;
import com.example.starter_project_2025.system.question.core.service.QuestionServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Puts an old version back through the normal update path so every rule (e.g. "question is in an exam") still applies. */
@Service
@RequiredArgsConstructor
public class QuestionRestoreService {

    private final QuestionVersionService versionService;
    private final QuestionServiceImpl questionService;
    private final QuestionRepository questionRepository;

    @Transactional
    public QuestionDTO restore(Long questionId, int versionNumber) {
        QuestionSnapshot snap = versionService.snapshot(questionId, versionNumber);
        Set<Long> currentOptionIds = new HashSet<>();
        questionRepository.findById(questionId)
                .ifPresent(q -> q.getOptions().forEach((QuestionOption o) -> currentOptionIds.add(o.getId())));

        QuestionDTO dto = toDto(snap, currentOptionIds);
        QuestionDTO saved = questionService.update(questionId, dto);
        // update() already recorded the new state; relabel it so the history reads "Restored from vN".
        versionService.labelLatest(questionId, "Restored from v" + versionNumber);
        return saved;
    }

    static QuestionDTO toDto(QuestionSnapshot s, Set<Long> currentOptionIds) {
        QuestionDTO dto = new QuestionDTO();
        dto.setContent(s.content());
        dto.setType(s.type() == null ? null : QuestionType.valueOf(s.type()));
        dto.setDifficulty(s.difficulty() == null ? null : Difficulty.valueOf(s.difficulty()));
        dto.setTopic(s.topic() == null ? "" : s.topic());
        dto.setImageUrl(s.imageUrl() == null ? "" : s.imageUrl());
        dto.setPoints(s.points());
        if (s.type() != null && QuestionType.valueOf(s.type()) == QuestionType.CODING && s.codeSpec() != null) {
            dto.setCode(CodeSpecSupport.forTeacher(s.codeSpec()));
        }
        List<QuestionDTO.OptionDTO> options = s.options() == null ? List.of() : s.options().stream().map(o -> {
            QuestionDTO.OptionDTO od = new QuestionDTO.OptionDTO();
            // Keep the id only if that option still exists; otherwise it is re-created as a new option.
            od.setId(o.id() != null && currentOptionIds.contains(o.id()) ? o.id() : null);
            od.setContent(o.content());
            od.setCorrect(o.correct());
            od.setImageUrl(o.imageUrl());
            return od;
        }).toList();
        dto.setOptions(options);
        List<QuestionDTO.EssayCriterionDTO> criteria = s.gradingCriteria() == null ? List.of()
                : s.gradingCriteria().stream().map(c -> {
                    QuestionDTO.EssayCriterionDTO cd = new QuestionDTO.EssayCriterionDTO();
                    cd.setName(c.name());
                    cd.setDescription(c.description());
                    cd.setWeightPercentage(c.weightPercentage());
                    return cd;
                }).toList();
        dto.setGradingCriteria(criteria);
        return dto;
    }
}
