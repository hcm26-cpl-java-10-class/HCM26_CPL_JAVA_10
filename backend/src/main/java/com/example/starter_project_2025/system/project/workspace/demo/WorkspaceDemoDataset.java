package com.example.starter_project_2025.system.project.workspace.demo;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity @Table(name = "workspace_demo_datasets")
@Getter @Setter @NoArgsConstructor
public class WorkspaceDemoDataset {
    @Id private Long tenantId;
    private int version;
}
