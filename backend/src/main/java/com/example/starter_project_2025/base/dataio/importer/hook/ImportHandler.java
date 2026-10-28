package com.example.starter_project_2025.base.dataio.importer.hook;

import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Optional per-entity hook for the generic importer. Register a Spring bean implementing this
 * interface to add rules to the import of one entity type (duplicate handling, updating existing
 * records, password handling, notification emails, ...). Entities without a handler are imported
 * as before.
 *
 * <p>Order for every row: {@link #shouldSkip} -> {@link #resolveExisting} (or the normal mapping)
 * -> {@link #beforeSave} -> save -> {@link #afterSave}.
 */
public interface ImportHandler<T> {

    Class<T> entityType();

    /** Called once with all rows before the first row is processed (for example to find duplicates). */
    default void beforeImport(List<Map<String, String>> rows) {
    }

    /** Called once after the last row, even when the import failed. Release per-import state here. */
    default void afterImport() {
    }

    /**
     * Called before the row is mapped. Return true to skip the row (nothing is saved). Skipped rows
     * are counted in {@link ImportResult#getSkippedCount()}. Throw an exception to reject the row.
     */
    default boolean shouldSkip(Map<String, String> row) {
        return false;
    }

    /**
     * Return the existing record this row refers to. It is then updated in place and the row is NOT
     * mapped into a new entity, so rows for existing records only need the columns being changed.
     */
    default Optional<T> resolveExisting(Map<String, String> row) {
        return Optional.empty();
    }

    /** Called before save. Throw an exception to reject the row; its message is reported for that row. */
    default void beforeSave(T entity, Map<String, String> row) {
    }

    /**
     * Called after the entity was saved. Failures here must not fail the row; report them through
     * {@link ImportResult} instead.
     */
    default void afterSave(T entity, Map<String, String> row, int rowNumber, ImportResult result) {
    }
}
