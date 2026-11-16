package com.example.starter_project_2025.config.startup;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a startup-only component that writes schema, fixtures, backfills or access data.
 * The master switch is checked before the bean is constructed, including migrations
 * that otherwise execute before Hibernate. Existing per-component conditions still apply.
 * Runtime controllers, services and repositories must not use this annotation.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@ConditionalOnProperty(prefix = "app.startup", name = "mutations-enabled",
        havingValue = "true", matchIfMissing = true)
public @interface StartupMutation {
}
