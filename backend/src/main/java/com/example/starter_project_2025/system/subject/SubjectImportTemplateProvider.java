package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateBuilder;
import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateColumn;
import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateProvider;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Provides the standardized Excel import template for Topics / Subjects.
 */
@Component
public class SubjectImportTemplateProvider implements ImportTemplateProvider {

    static final String ENTITY = "subject";

    @Override
    public String entity() {
        return ENTITY;
    }

    @Override
    public byte[] generate(Class<?> entityClass) {
        return ImportTemplateBuilder.forEntity(entityClass, "Topics / Subjects")
                .column(ImportTemplateColumn.text(
                        "Code", true,
                        "Unique together with Version (uppercase normalized, max 50 chars)", "L1_AL_CCGM"))
                .column(ImportTemplateColumn.text(
                        "Name", true,
                        "Topic display name (max 255 chars)", "Clean Code and Git Multi-platform"))
                .column(ImportTemplateColumn.text(
                        "Version", true,
                        "Version string, e.g. 1.0 (v1.0 and 1.0 are treated as equal, max 20 chars)", "1.0"))
                .column(ImportTemplateColumn.text(
                        "Technical Group", false,
                        "Descriptive category name (cannot be numbers only, max 100 chars)", "Java"))
                .column(ImportTemplateColumn.integer(
                        "Duration (Hours)", true,
                        "Positive integer between 1 and 1000 hours", "40"))
                .column(ImportTemplateColumn.text(
                        "Description", false,
                        "Topic objectives and summary (max 1000 chars)", "Clean code guidelines and Git branching workflows"))
                .column(ImportTemplateColumn.choice(
                        "Status", false,
                        List.of("ACTIVE", "INACTIVE"),
                        "Defaults to ACTIVE if left blank", "ACTIVE"))
                .rule(
                        "Code + Version must be unique across the import file and existing database (v1.0 = 1.0).",
                        "Duration (Hours) must be a whole number from 1 to 1000.",
                        "Technical Group must contain text (purely numeric values are rejected).",
                        "Strict Rollback: if any row has an error, the entire import is rejected.")
                .build();
    }
}

