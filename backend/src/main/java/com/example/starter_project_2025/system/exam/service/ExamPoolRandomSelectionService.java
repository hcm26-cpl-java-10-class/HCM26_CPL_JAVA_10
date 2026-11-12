package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.ExamPoolQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamQuestionPoolVersion;
import org.springframework.stereotype.Service;
import com.example.starter_project_2025.exception.BadRequestException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

@Service
public class ExamPoolRandomSelectionService {

    public List<ExamPoolQuestion> selectQuestions(
            ExamQuestionPoolVersion version,
            List<ExamPoolQuestion> validQuestions
    ) {
        if (version == null) {
            throw new IllegalArgumentException(
                    "Question Pool Version is required"
            );
        }

        List<ExamPoolQuestion> candidates =
                new ArrayList<>(
                        validQuestions == null
                                ? List.of()
                                : validQuestions
                );

        candidates.sort(
                Comparator.comparing(
                        ExamPoolQuestion::getDisplayOrder
                )
        );

        if (candidates.isEmpty()) {
            throw new BadRequestException(
                    "Question Pool has no valid questions"
            );
        }

        boolean randomEnabled =
                Boolean.TRUE.equals(
                        version.getRandomSelectionEnabled()
                );

        boolean shuffleOrder =
                Boolean.TRUE.equals(
                        version.getShuffleQuestionOrder()
                );

        if (randomEnabled) {
            Integer configuredCount =
                    version.getRandomQuestionCount();

            if (configuredCount == null || configuredCount < 1) {
                throw new BadRequestException(
                        "Invalid random question count"
                );
            }

            if (candidates.size() < configuredCount) {
                throw new BadRequestException(
                        "Not enough valid questions. Required: "
                                + configuredCount
                                + ", available: "
                                + candidates.size()
                );
            }

            // Random sample without replacement.
            Collections.shuffle(candidates);

            candidates = new ArrayList<>(
                    candidates.subList(0, configuredCount)
            );
        }

        if (shuffleOrder) {
            Collections.shuffle(candidates);
        } else {
            candidates.sort(
                    Comparator.comparing(
                            ExamPoolQuestion::getDisplayOrder
                    )
            );
        }

        return candidates;
    }
}
