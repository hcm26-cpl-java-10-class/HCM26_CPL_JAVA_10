package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptOption;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamPoolQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamPoolQuestionOption;
import org.springframework.stereotype.Service;
import com.example.starter_project_2025.system.question.domain.EssayGradingCriterion;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class ExamPoolAttemptSnapshotService {

    public List<ExamAttemptQuestion> createSnapshots(
            ExamAttempt attempt,
            List<ExamPoolQuestion> selectedQuestions
    ) {
        if (attempt == null) {
            throw new IllegalArgumentException(
                    "Attempt is required"
            );
        }

        if (selectedQuestions == null || selectedQuestions.isEmpty()) {
            throw new IllegalArgumentException(
                    "Selected questions are required"
            );
        }

        List<ExamAttemptQuestion> snapshots = new ArrayList<>();

        for (int i = 0; i < selectedQuestions.size(); i++) {
            ExamPoolQuestion source = selectedQuestions.get(i);

            ExamAttemptQuestion snapshot = new ExamAttemptQuestion();

            snapshot.setAttempt(attempt);
            snapshot.setSourceQuestionId(source.getQuestionId());
            snapshot.setContent(source.getContent());
            snapshot.setType(source.getType());
            snapshot.setPoints(source.getPoints());
            snapshot.setImageUrl(source.getImageUrl());
            snapshot.setCodeSpec(source.getCodeSpec());
            snapshot.setDisplayOrder(i);

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
                List<ExamPoolQuestionOption> sourceOptions =
                        new ArrayList<>(source.getOptions());

                sourceOptions.sort(
                        Comparator.comparing(ExamPoolQuestionOption::getDisplayOrder)
                );

                for (ExamPoolQuestionOption sourceOption : sourceOptions) {
                    ExamAttemptOption option = new ExamAttemptOption();

                    option.setQuestion(snapshot);
                    option.setSourceOptionId(sourceOption.getSourceOptionId());
                    option.setContent(sourceOption.getContent());
                    option.setCorrect(sourceOption.isCorrect());
                    option.setImageUrl(sourceOption.getImageUrl());
                    option.setDisplayOrder(sourceOption.getDisplayOrder());

                    snapshot.getOptions().add(option);
                }
            }
            snapshots.add(snapshot);
        }

        return snapshots;
    }
}
