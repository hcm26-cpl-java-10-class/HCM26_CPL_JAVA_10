package com.example.starter_project_2025.base.dataio.importer.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Opt-in import upsert strategy. Only entities annotated with this annotation
 * are matched against an existing row; all other imports keep INSERT behavior.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ImportUpsert {
    /** Java field used to locate an existing entity. */
    String keyField();

    /** Human-readable entity name used in import errors. */
    String displayName() default "record";
}
