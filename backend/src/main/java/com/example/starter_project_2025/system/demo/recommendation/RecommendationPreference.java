package com.example.starter_project_2025.system.demo.recommendation;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.util.HashSet;
import java.util.Set;

@Entity @Table(name = "course_recommendation_preferences") @Getter @Setter
public class RecommendationPreference {
    @Id private Long userId;
    @Version private Long version;
    @Column(length = 1000, nullable = false) private String goals = "";
    @ElementCollection
    @CollectionTable(name = "course_recommendation_interests", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "topic", length = 80) private Set<String> interests = new HashSet<>();
    @ElementCollection
    @CollectionTable(name = "course_recommendation_dismissals", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "course_id") private Set<Long> dismissed = new HashSet<>();
}
