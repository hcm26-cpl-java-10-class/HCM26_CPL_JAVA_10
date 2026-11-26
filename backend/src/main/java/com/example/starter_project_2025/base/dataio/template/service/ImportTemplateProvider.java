package com.example.starter_project_2025.base.dataio.template.service;

/**
 * Supplies the downloadable import template of one entity.
 * <p>
 * A module that needs a documented template (required columns, dropdown values,
 * examples, business rules) implements this interface inside its own package and
 * registers it as a Spring bean. {@code ImportTemplateController} prefers a
 * provider over the generic header-only template of
 * {@link ImportTemplateService}.
 */
public interface ImportTemplateProvider {

    /**
     * Registry key of the handled entity, matching its
     * {@code @ImportEntity} value and the {@code entityName} the frontend schema
     * sends to {@code GET /api/import/template?entity=...}.
     */
    String entity();

    /**
     * Builds the XLSX file of the template.
     *
     * @param entityClass entity the template is generated for; the columns must
     *                    match its {@code @ImportField} headers so the file can
     *                    be imported again.
     */
    byte[] generate(Class<?> entityClass);
}
