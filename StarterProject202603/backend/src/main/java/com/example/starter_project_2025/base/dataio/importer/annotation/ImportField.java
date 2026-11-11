package com.example.starter_project_2025.base.dataio.importer.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface ImportField {

    String name();

    boolean required() default false;

    String relationPath() default "";

    Class<?> lookupEntity() default Void.class;

    String lookupField() default "id";

    String separator() default ",";
}
