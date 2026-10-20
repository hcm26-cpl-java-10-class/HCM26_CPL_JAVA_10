package com.example.starter_project_2025.init.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ResourceMenu {

    String title();

    String group();

    String icon() default "circle";

    String url();

    int order() default 0;

    String permission() default "";
}
