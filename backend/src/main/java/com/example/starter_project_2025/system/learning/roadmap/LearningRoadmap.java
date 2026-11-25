package com.example.starter_project_2025.system.learning.roadmap;

import com.example.starter_project_2025.system.demo.course.CourseLevel;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.Instant;

@Entity
@Table(name = "learning_roadmaps")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LearningRoadmap {
    @Id
    private Long userId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Version
    @Column(nullable = false)
    private Long revision;

    @Column(nullable = false, length = 150)
    private String careerGoal;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CourseLevel currentLevel;

    @Column(nullable = false)
    private int hoursPerWeek;

    @Column(nullable = false)
    private int durationMonths;
    private Integer durationWeeks;
    private Boolean planOutdated;

    @Column(columnDefinition = "text")
    private String planJson;

    private Instant generatedAt;

    LearningRoadmap(User user, RoadmapGoal goal) {
        this.user = user;
        changeGoal(goal);
    }

    RoadmapGoal goal() {
        return new RoadmapGoal(careerGoal, currentLevel, hoursPerWeek, durationMonths, durationWeeks);
    }

    void changeGoal(RoadmapGoal goal) {
        if (goal.equals(goal())) {
            return;
        }
        careerGoal = goal.careerGoal();
        currentLevel = goal.currentLevel();
        hoursPerWeek = goal.hoursPerWeek();
        durationMonths = (goal.targetWeeks() + 3) / 4;
        durationWeeks = goal.durationWeeks();
        planOutdated = planJson != null;
    }

    void updatePlan(String planJson) {
        this.planJson = planJson;
        generatedAt = Instant.now();
        planOutdated = false;
    }
}
