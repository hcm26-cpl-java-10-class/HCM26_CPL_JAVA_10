package com.example.starter_project_2025.system.project.template.content;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;

public class TemplateBacklogImportRow {
    @ImportField(name = "Title")
    String title;

    @ImportField(name = "Description")
    String description;
}
