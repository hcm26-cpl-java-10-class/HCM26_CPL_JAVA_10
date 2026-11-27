package com.example.starter_project_2025.system.exam.pool.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** "Draw {count} questions with this difficulty and/or topic". A null field means "any". */
@Getter
@Setter
@NoArgsConstructor
public class PoolQuotaDTO {

    /** EASY / MEDIUM / HARD, or null for any difficulty. */
    private String difficulty;

    /** Topic text, or null/blank for any topic. */
    private String topic;

    private int count;

    public PoolQuotaDTO(String difficulty, String topic, int count) {
        this.difficulty = difficulty;
        this.topic = topic;
        this.count = count;
    }
}
