package com.example.starter_project_2025.system.learning.habits;

import jakarta.persistence.*;
import java.time.*;
import java.util.ArrayList;
import java.util.List;

enum GoalPeriod { WEEKLY, MONTHLY }
enum StudySource { TIMER, MANUAL }
enum StudyState { RUNNING, PAUSED, COMPLETED, CANCELLED, EXPIRED }

@Entity
@Table(name = "habit_goals", indexes = @Index(columnList = "owner_id,period"))
class HabitGoal {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(name = "owner_id", nullable = false) Long ownerId;
    @Version long version;
    @Enumerated(EnumType.STRING) @Column(nullable = false) GoalPeriod period;
    @Column(nullable = false, length = 150) String title;
    @Column(length = 2000) String description;
    @Column(nullable = false) int targetMinutes;
    @Column(nullable = false) LocalDate startDate;
    LocalDate endDate;
    LocalDate archivedOn;
    @Column(nullable = false) LocalDate historyFrom;
}

@Entity
@Table(name = "habit_goal_targets", uniqueConstraints = @UniqueConstraint(columnNames = {"owner_id", "period", "period_start"}))
class HabitGoalTarget {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(name = "owner_id", nullable = false) Long ownerId;
    @Column(nullable = false) Long goalId;
    @Enumerated(EnumType.STRING) @Column(nullable = false) GoalPeriod period;
    @Column(name = "period_start", nullable = false) LocalDate periodStart;
    @Column(nullable = false) LocalDate fromDate;
    @Column(nullable = false) LocalDate toDate;
    @Column(nullable = false, length = 150) String title;
    @Column(nullable = false) int targetMinutes;
}

@Embeddable
class StudyInterval {
    @Column(nullable = false) Instant startedAt;
    Instant stoppedAt;

    protected StudyInterval() {}

    StudyInterval(Instant startedAt) {
        this.startedAt = startedAt;
    }
}

@Entity
@Table(name = "habit_sessions",
    indexes = @Index(columnList = "owner_id,study_date"),
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"owner_id", "request_key"}),
        @UniqueConstraint(columnNames = "active_owner_id")
    })
class HabitSession {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Version long version;
    @Column(name = "owner_id", nullable = false) Long ownerId;
    @Column(name = "active_owner_id") Long activeOwnerId;
    @Column(name = "request_key", nullable = false, length = 36) String requestKey;
    Long courseId;
    @Column(length = 255) String courseName;
    @Column(nullable = false, length = 150) String title;
    @Column(length = 2000) String notes;
    @Enumerated(EnumType.STRING) @Column(nullable = false) StudySource source;
    @Enumerated(EnumType.STRING) @Column(nullable = false) StudyState state;
    @Column(name = "study_date", nullable = false) LocalDate studyDate;
    @Column(nullable = false) long elapsedSeconds;
    @Column(nullable = false) boolean corrected;
    @Column(nullable = false) Instant createdAt;
    @Column(nullable = false) Instant updatedAt;
    Instant finishedAt;
    @Column(nullable = false, length = 80) String zone;
    @Column(nullable = false) boolean deleted;

    @ElementCollection
    @CollectionTable(name = "habit_session_intervals", joinColumns = @JoinColumn(name = "session_id"))
    @OrderColumn(name = "sequence_no")
    List<StudyInterval> intervals = new ArrayList<>();
}

@Entity
@Table(name = "habit_objectives", indexes = @Index(columnList = "owner_id,week_start"))
class HabitObjective {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Version long version;
    @Column(name = "owner_id", nullable = false) Long ownerId;
    Long courseId;
    @Column(length = 255) String courseName;
    @Column(nullable = false, length = 150) String title;
    @Column(length = 2000) String description;
    @Column(name = "week_start", nullable = false) LocalDate weekStart;
    LocalDate targetDate;
    Instant completedAt;
    @Column(nullable = false) int displayOrder;
}
