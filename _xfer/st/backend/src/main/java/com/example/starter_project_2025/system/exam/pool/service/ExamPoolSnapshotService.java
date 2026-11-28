package com.example.starter_project_2025.system.exam.pool.service;

import com.example.starter_project_2025.system.exam.pool.domain.ExamPoolQuestion;
import com.example.starter_project_2025.system.exam.pool.domain.ExamPoolQuestionOption;
import com.example.starter_project_2025.system.exam.pool.domain.ExamQuestionPoolVersion;
import com.example.starter_project_2025.system.question.core.domain.EssayGradingCriterion;
import com.example.starter_project_2025.system.question.core.domain.Question;
import com.example.starter_project_2025.system.question.core.domain.QuestionOption;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class ExamPoolSnapshotService {

    public ExamPoolQuestion createSnapshot(
            Question source,
            ExamQuestionPoolVersion version,
            int displayOrder
    ) {
        if (source == null || version == null) {
            throw new IllegalArgumentException(
                    "Question and pool version are required"
            );
        }

        ExamPoolQuestion snapshot = new ExamPoolQuestion();

        snapshot.setPoolVersion(version);
        snapshot.setQuestionId(source.getId());
        snapshot.setDisplayOrder(displayOrder);

        snapshot.setContent(source.getContent());
        snapshot.setType(source.getType());
        snapshot.setPoints(source.getPoints());
        snapshot.setImageUrl(source.getImageUrl());
        snapshot.setCodeSpec(source.getCodeSpec());
        snapshot.setDifficulty(source.getDifficulty() == null ? null : source.getDifficulty().name());
        snapshot.setTopic(source.getTopic());

        if (source.getGradingCriteria() != null) {
            List<EssayGradingCriterion> criteria = new ArrayList<>();

            for (EssayGradingCriterion sourceCriterion
                    : source.getGradingCriteria()) {

                EssayGradingCriterion criterion =
                        new EssayGradingCriterion();

                criterion.setName(sourceCriterion.getName());
                criterion.setDescription(sourceCriterion.getDescription());
                criterion.setWeightPercentage(
                        sourceCriterion.getWeightPercentage()
                );

                criteria.add(criterion);
            }

            snapshot.setGradingCriteria(criteria);
        }

        if (source.getOptions() != null) {
            int optionOrder = 0;

            List<QuestionOption> sourceOptions =
                    new ArrayList<>(source.getOptions());

            sourceOptions.sort(
                    Comparator.comparing(QuestionOption::getId)
            );

            for (QuestionOption sourceOption : sourceOptions) {
                ExamPoolQuestionOption option =
                        new ExamPoolQuestionOption();

                option.setPoolQuestion(snapshot);
                option.setSourceOptionId(sourceOption.getId());
                option.setContent(sourceOption.getContent());
                option.setCorrect(sourceOption.isCorrect());
                option.setImageUrl(sourceOption.getImageUrl());
                option.setDisplayOrder(optionOrder++);

                snapshot.getOptions().add(option);
            }
        }

        return snapshot;
    }
}
