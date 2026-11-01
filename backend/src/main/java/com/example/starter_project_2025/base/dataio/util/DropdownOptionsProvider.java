package com.example.starter_project_2025.base.dataio.util;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.metamodel.EntityType;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;

/**
 * Reads the values that currently exist in the database for an entity field (for example every role name),
 * so the drop-downs of an exported file always match the data, including roles created a minute ago.
 */
@Component
public class DropdownOptionsProvider {

    @PersistenceContext
    private EntityManager entityManager;

    public List<String> load(Class<?> entity, String field) {
        if (entity.isEnum()) {
            return Arrays.stream(entity.getEnumConstants()).map(c -> ((Enum<?>) c).name()).toList();
        }
        String path = (field == null || field.isBlank()) ? "id" : field.trim();
        if (!path.matches("[A-Za-z_][A-Za-z0-9_.]*")) {
            throw new IllegalArgumentException("Invalid option field: " + field);
        }

        EntityType<?> type = entityManager.getMetamodel().entity(entity);
        boolean hasActiveFlag = type.getAttributes().stream().anyMatch(a -> "isActive".equals(a.getName()));

        String jpql = "select distinct e." + path + " from " + type.getName() + " e"
                + " where e." + path + " is not null"
                + (hasActiveFlag ? " and e.isActive = true" : "")
                + " order by e." + path;

        return entityManager.createQuery(jpql, Object.class).getResultList().stream()
                .filter(Objects::nonNull)
                .map(String::valueOf)
                .toList();
    }
}
