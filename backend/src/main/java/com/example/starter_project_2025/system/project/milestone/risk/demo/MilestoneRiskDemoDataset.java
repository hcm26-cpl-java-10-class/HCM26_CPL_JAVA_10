package com.example.starter_project_2025.system.project.milestone.risk.demo;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name = "milestone_risk_demo_datasets")
@Getter @Setter @NoArgsConstructor
public class MilestoneRiskDemoDataset {
    @Id private Long tenantId;
}
