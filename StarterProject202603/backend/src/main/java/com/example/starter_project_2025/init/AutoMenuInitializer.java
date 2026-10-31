package com.example.starter_project_2025.init;

import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.system.menu.module.Module;
import com.example.starter_project_2025.system.menu.module.ModuleRepository;
import com.example.starter_project_2025.system.menu.module_groups.ModuleGroup;
import com.example.starter_project_2025.system.menu.module_groups.ModuleGroupRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.Order;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

@Slf4j
@Order(10)
@Component
@RequiredArgsConstructor
public class AutoMenuInitializer implements CommandLineRunner {

    private final ModuleRepository moduleRepository;
    private final ModuleGroupRepository groupRepository;

    private static final String BASE_PACKAGE = "com.example";

    @Override
    @Transactional
    public void run(String... args) throws Exception {

        log.info("Starting Auto Menu Initialization...");

        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);

        scanner.addIncludeFilter(new AnnotationTypeFilter(ResourceMenu.class));

        Set<BeanDefinition> candidates =
                scanner.findCandidateComponents(BASE_PACKAGE);

        for (var candidate : candidates) {

            Class<?> clazz = Class.forName(candidate.getBeanClassName());

            ResourceMenu menu = clazz.getAnnotation(ResourceMenu.class);

            generateMenu(clazz, menu);
        }

        log.info("Auto Menu Initialization completed.");
    }

    private void generateMenu(Class<?> clazz, ResourceMenu menu) {

        String url = normalizeUrl(menu.url());

        Module module = moduleRepository.findByUrl(url).orElseGet(Module::new);
        boolean isNew = module.getId() == null;

        ModuleGroup group = getOrCreateGroup(menu.group());

        module.setModuleGroup(group);
        module.setTitle(menu.title());
        module.setUrl(url);
        module.setIcon(menu.icon());
        module.setDisplayOrder(menu.order());
        module.setRequiredPermission(normalizePermission(menu.permission()));
        module.setDescription("Auto generated menu for " + clazz.getSimpleName());
        module.setIsActive(true);

        moduleRepository.save(module);

        if (isNew) {
            log.info("Created menu [{}] -> {}", menu.title(), url);
            return;
        }

        log.info("Synchronized menu [{}] -> {}", menu.title(), url);
    }

    private ModuleGroup getOrCreateGroup(String groupName) {

        return groupRepository.findByName(groupName)
                .orElseGet(() -> {

                    ModuleGroup group = new ModuleGroup();

                    group.setName(groupName);
                    group.setDescription("Auto generated group");
                    group.setDisplayOrder(0);
                    group.setIsActive(true);

                    ModuleGroup saved = groupRepository.save(group);

                    log.info("Created module group: {}", groupName);

                    return saved;
                });
    }

    private String normalizeUrl(String url) {

        if (url == null || url.isBlank())
            return "";

        url = url.trim().toLowerCase(Locale.ROOT);

        if (!url.startsWith("/"))
            url = "/" + url;

        return url;
    }

    private String normalizePermission(String permission) {

        if (permission == null || permission.isBlank()) {
            return null;
        }

        return permission.trim().toUpperCase(Locale.ROOT);
    }
}
