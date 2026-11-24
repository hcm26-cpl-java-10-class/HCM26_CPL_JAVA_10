package com.example.starter_project_2025.system.project.developmentinsights.domain;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/** Stable fixture identity, so editing or deleting sample Sprints never reseeds them. */
@Entity
@Table(name = "git_activity_demo_sprint")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GitActivityDemoSprint {
    @Id
    @Column(name = "project_id")
    private Long projectId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_git_demo_sprint_project"))
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repository_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_git_demo_sprint_repository"))
    @OnDelete(action = OnDeleteAction.CASCADE)
    private GitRepository repository;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "report_sprint_id", referencedColumnName = "sprint_id",
            foreignKey = @ForeignKey(name = "fk_git_demo_sprint_report"))
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private Sprint reportSprint;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "empty_sprint_id", referencedColumnName = "sprint_id",
            foreignKey = @ForeignKey(name = "fk_git_demo_sprint_empty"))
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private Sprint emptySprint;

    public static GitActivityDemoSprint register(Project project, GitRepository repository, Sprint report, Sprint empty) {
        if (!repository.isMockData()) throw new IllegalArgumentException("Demo metadata requires a mock repository");
        GitActivityDemoSprint fixture = new GitActivityDemoSprint();
        fixture.projectId = project.getId();
        fixture.project = project;
        fixture.repository = repository;
        fixture.reportSprint = report;
        fixture.emptySprint = empty;
        return fixture;
    }
}
