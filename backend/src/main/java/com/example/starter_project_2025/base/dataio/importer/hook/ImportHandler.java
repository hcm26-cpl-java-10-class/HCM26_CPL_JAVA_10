package com.example.starter_project_2025.base.dataio.importer.hook;

import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;

import java.util.Map;

/**
 * Optional per-entity hook for the generic importer. Register a Spring bean implementing this
 * interface to add rules to the import of one entity type (duplicate handling, password
 * generation, notification emails, ...). Entities without a handler are imported as before.
 */
public interface ImportHandler<T> {

    Class<T> entityType();

    /**
     * Called before the row is mapped. Return true to skip the row silently (for example when the
     * record already exists). Skipped rows are counted in {@link ImportResult#getSkippedCount()}.
     */
    default boolean shouldSkip(Map<String, String> row) {
        return false;
    }

    /**
     * Allows an entity-specific handler to update an existing record instead of inserting a new one.
     * Called after mapping and before validation/save.
     */
    default T mergeExisting(T mappedEntity, Map<String, String> row) {
        return mappedEntity;
    }

    /**
     * Called after mapping/merging and before save. Throw an exception to reject the row.
     */
    default void beforeSave(T entity, Map<String, String> row) {
    }

    /**
     * Called after the entity was saved. Failures here must not fail the row; report them through
     * {@link ImportResult} instead.
     */
    default void afterSave(T entity, Map<String, String> row, int rowNumber, ImportResult result) {
    }
}
