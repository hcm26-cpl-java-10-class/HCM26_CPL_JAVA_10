package com.example.starter_project_2025.system.question.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
public class EssayGradingCriterion {

    @Column(name = "criterion_name", nullable = false, length = 200)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(name = "weight_percentage", nullable = false)
    private int weightPercentage;
}
