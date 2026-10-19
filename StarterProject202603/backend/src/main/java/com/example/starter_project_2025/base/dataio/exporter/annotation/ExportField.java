package com.example.starter_project_2025.base.dataio.exporter.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface ExportField {

    String name();

    boolean ignore() default false;

    String dateFormat() default "";

    String path() default "";

    boolean relation() default false;

    String separator() default ", ";
}
