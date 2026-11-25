package com.example.starter_project_2025.system.audit;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.util.ClassUtils;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Collects the rules of every {@link AuditRuleProvider} and finds the rule of a method.
 */
@Component
public class AuditRuleRegistry {

    private final Map<String, List<AuditRule>> rulesByMethod = new HashMap<>();
    private final Map<String, Optional<AuditRule>> cache = new ConcurrentHashMap<>();

    public AuditRuleRegistry(ObjectProvider<AuditRuleProvider> providers) {
        providers.orderedStream().forEach(provider -> {
            for (AuditRule rule : provider.auditRules()) {
                rulesByMethod
                        .computeIfAbsent(rule.method(), key -> new ArrayList<>())
                        .add(rule);
            }
        });
    }

    public Optional<AuditRule> find(Class<?> targetClass, Method method) {
        if (targetClass == null || method == null) {
            return Optional.empty();
        }

        List<AuditRule> candidates = rulesByMethod.get(method.getName());

        if (candidates == null) {
            return Optional.empty();
        }

        Class<?> userClass = ClassUtils.getUserClass(targetClass);
        String cacheKey = userClass.getName() + "#" + method.getName();

        return cache.computeIfAbsent(cacheKey, key -> {
            Set<String> typeNames = new HashSet<>();
            collectTypeNames(userClass, typeNames);

            return candidates.stream()
                    .filter(rule -> typeNames.contains(rule.targetClass()))
                    .findFirst();
        });
    }

    private static void collectTypeNames(Class<?> type, Set<String> names) {
        if (type == null || Object.class.equals(type)) {
            return;
        }

        names.add(type.getSimpleName());
        collectTypeNames(type.getSuperclass(), names);

        for (Class<?> parent : type.getInterfaces()) {
            collectTypeNames(parent, names);
        }
    }
}
