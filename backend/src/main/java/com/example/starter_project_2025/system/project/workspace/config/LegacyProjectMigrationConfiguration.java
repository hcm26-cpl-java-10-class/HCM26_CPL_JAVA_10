package com.example.starter_project_2025.system.project.workspace.config;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.LinkedHashSet;

/** Data must be converted before Hibernate attempts UUID-to-BIGINT schema updates. */
@Configuration(proxyBeanMethods = false)
public class LegacyProjectMigrationConfiguration {
    @Bean
    static BeanFactoryPostProcessor legacyProjectMigrationBeforeHibernate() {
        return beans -> {
            if (!beans.containsBeanDefinition("entityManagerFactory")) return;
            var definition = beans.getBeanDefinition("entityManagerFactory");
            var dependencies = new LinkedHashSet<String>();
            if (definition.getDependsOn() != null) dependencies.addAll(Arrays.asList(definition.getDependsOn()));
            dependencies.add("legacyH2ProjectSchemaMigration");
            definition.setDependsOn(dependencies.toArray(String[]::new));
        };
    }
}
