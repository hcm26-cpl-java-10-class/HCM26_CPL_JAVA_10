package com.example.starter_project_2025.config.startup;

import com.example.starter_project_2025.system.project.workspace.config.LegacyProjectMigrationConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.type.classreading.CachingMetadataReaderFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.config.TaskManagementConfigUtils;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

class StartupSafetyConfigurationTest {

    private final ApplicationContextRunner context = new ApplicationContextRunner();

    @Test
    void disabledGateSkipsConstructionAndPreHibernateMigrationDependency() {
        AtomicInteger constructed = new AtomicInteger();
        context.withBean(AtomicInteger.class, () -> constructed)
                .withBean("entityManagerFactory", Object.class, Object::new)
                .withUserConfiguration(MutatingStartupProbe.class, LegacyProjectMigrationConfiguration.class)
                .withPropertyValues("app.startup.mutations-enabled=false")
                .run(application -> {
                    assertThat(application).hasNotFailed();
                    assertThat(application).doesNotHaveBean(MutatingStartupProbe.class);
                    assertThat(application).doesNotHaveBean(LegacyProjectMigrationConfiguration.class);
                    assertThat(application).doesNotHaveBean("legacyProjectMigrationBeforeHibernate");
                    assertThat(application.getBeanFactory().getBeanDefinition("entityManagerFactory")
                            .getDependsOn()).isNullOrEmpty();
                    assertThat(constructed).hasValue(0);
                });
    }

    @Test
    void defaultGatePreservesExistingDevelopmentStartupBehavior() {
        AtomicInteger constructed = new AtomicInteger();
        context.withBean(AtomicInteger.class, () -> constructed)
                .withUserConfiguration(MutatingStartupProbe.class)
                .run(application -> {
                    assertThat(application).hasSingleBean(MutatingStartupProbe.class);
                    assertThat(constructed).hasValue(1);
                });
    }

    @Test
    void masterGateDoesNotOverrideExistingComponentOptIn() {
        context.withUserConfiguration(OptInStartupProbe.class)
                .withPropertyValues("app.startup.mutations-enabled=true", "test.fixture.enabled=false")
                .run(application -> assertThat(application).doesNotHaveBean(OptInStartupProbe.class));
        context.withUserConfiguration(OptInStartupProbe.class)
                .withPropertyValues("app.startup.mutations-enabled=false", "test.fixture.enabled=true")
                .run(application -> assertThat(application).doesNotHaveBean(OptInStartupProbe.class));
        context.withUserConfiguration(OptInStartupProbe.class)
                .withPropertyValues("app.startup.mutations-enabled=true", "test.fixture.enabled=true")
                .run(application -> assertThat(application).hasSingleBean(OptInStartupProbe.class));
    }

    @Test
    void safeProfileRequiresValidationWithoutJpaSchemaActionOverride() throws IOException {
        Properties properties = new Properties();
        try (var input = getClass().getResourceAsStream("/application-safe-deployment.properties")) {
            assertThat(input).isNotNull();
            properties.load(input);
        }
        assertThat(properties).containsEntry("app.startup.mutations-enabled", "false")
                .containsEntry("app.scheduling.enabled", "false")
                .containsEntry("spring.jpa.hibernate.ddl-auto", "validate")
                .containsEntry("spring.sql.init.mode", "never");
        assertThat(properties).doesNotContainKey(
                "spring.jpa.properties.jakarta.persistence.schema-generation.database.action");
    }

    @Test
    void disabledSchedulingPreservesJobAndRuntimeServiceBeans() {
        context.withUserConfiguration(SchedulingConfiguration.class, RuntimeConfiguration.class)
                .withPropertyValues("app.scheduling.enabled=false")
                .run(application -> {
                    assertThat(application).hasNotFailed();
                    assertThat(application).hasSingleBean(BackgroundJob.class);
                    assertThat(application).hasBean("runtimeService");
                    assertThat(application).doesNotHaveBean(
                            TaskManagementConfigUtils.SCHEDULED_ANNOTATION_PROCESSOR_BEAN_NAME);
                });
    }

    @Test
    void schedulingRemainsEnabledByDefault() {
        context.withUserConfiguration(SchedulingConfiguration.class)
                .run(application -> assertThat(application).hasBean(
                        TaskManagementConfigUtils.SCHEDULED_ANNOTATION_PROCESSOR_BEAN_NAME));
    }

    @Test
    void allDiscoveredStartupCallbacksRequireExplicitMutationGate() throws IOException {
        // Prevent a new startup runner or @PostConstruct writer from silently bypassing
        // preservation-first deployment. A read-only callback should be reviewed before
        // adding an explicit exception here.
        var resolver = new PathMatchingResourcePatternResolver();
        var readerFactory = new CachingMetadataReaderFactory(resolver);
        List<String> startupCallbacks = new ArrayList<>();
        List<String> ungated = new ArrayList<>();
        for (var resource : resolver.getResources(
                "classpath*:com/example/starter_project_2025/**/*.class")) {
            var metadata = readerFactory.getMetadataReader(resource).getAnnotationMetadata();
            // Ignore test probes, nested classes and annotation definitions.
            if (metadata.getClassName().contains("$") || metadata.isAnnotation()) continue;
            boolean startupCallback = List.of(metadata.getInterfaceNames()).stream().anyMatch(name ->
                    name.equals("org.springframework.boot.CommandLineRunner")
                            || name.equals("org.springframework.boot.ApplicationRunner"))
                    || metadata.hasAnnotatedMethods("jakarta.annotation.PostConstruct")
                    || metadata.getAnnotatedMethods("org.springframework.context.event.EventListener")
                            .stream().anyMatch(method -> {
                                var values = method.getAnnotationAttributes(
                                        "org.springframework.context.event.EventListener", true);
                                if (values == null) return false;
                                for (String attribute : List.of("value", "classes")) {
                                    Object classes = values.get(attribute);
                                    if (classes instanceof String[] names
                                            && List.of(names).contains(
                                            "org.springframework.boot.context.event.ApplicationReadyEvent")) {
                                        return true;
                                    }
                                }
                                return false;
                            });
            if (!startupCallback) continue;
            startupCallbacks.add(metadata.getClassName());
            if (!metadata.hasAnnotation(StartupMutation.class.getName())) ungated.add(metadata.getClassName());
        }
        assertThat(startupCallbacks).hasSizeGreaterThanOrEqualTo(65);
        assertThat(ungated).as("Startup callbacks without the preservation gate").isEmpty();
    }

    @StartupMutation
    static class MutatingStartupProbe {
        MutatingStartupProbe(AtomicInteger constructed) {
            constructed.incrementAndGet();
        }
    }

    @StartupMutation
    @ConditionalOnProperty(name = "test.fixture.enabled", havingValue = "true")
    static class OptInStartupProbe { }

    @Configuration(proxyBeanMethods = false)
    static class RuntimeConfiguration {
        @Bean BackgroundJob backgroundJob() { return new BackgroundJob(); }
        @Bean Object runtimeService(BackgroundJob job) { return new Object(); }
    }

    static class BackgroundJob {
        @Scheduled(fixedDelay = 60000) public void writePendingWork() { }
    }
}
