package com.example.starter_project_2025.system.project;

import java.util.List;
import static com.example.starter_project_2025.system.project.WorkspaceSectionDtos.*;

public interface WorkspaceSectionDataSource {
    List<Item> list(Scope scope, WorkspaceSection section);
    Item create(Scope scope, WorkspaceSection section, Create request, String status);
    Item updateTask(Scope scope, String id, Create request);
    Item review(Scope scope, Review request);
}
