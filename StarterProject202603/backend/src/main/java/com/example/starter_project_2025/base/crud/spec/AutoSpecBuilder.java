package com.example.starter_project_2025.base.crud.spec;

import jakarta.persistence.criteria.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.util.*;

@Component
public class AutoSpecBuilder {

    public <E, F> Specification<E> build(F filter) {

        if (filter == null)
            return null;

        return (root, query, cb) -> {

            Map<String, From<?, ?>> joinCache = new HashMap<>();
            List<Predicate> predicates = new ArrayList<>();

            for (Field field : getAllFields(filter.getClass())) {

                field.setAccessible(true);

                FilterField annotation = field.getAnnotation(FilterField.class);
                if (annotation == null)
                    continue;

                Object value = getValue(field, filter);
                if (value == null)
                    continue;

                String entityField = annotation.entityField().isEmpty()
                        ? field.getName()
                        : annotation.entityField();

                Path<?> path = resolvePath(root, entityField, joinCache);

                Predicate predicate = buildPredicate(cb, path, value, annotation);
                if (predicate != null) {
                    predicates.add(predicate);
                }
            }

            if (predicates.isEmpty())
                return null;

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Path<?> resolvePath(
            From<?, ?> root,
            String fieldPath,
            Map<String, From<?, ?>> joinCache) {

        String[] parts = fieldPath.split("\\.");

        From<?, ?> current = root;

        for (int i = 0; i < parts.length - 1; i++) {

            String joinKey = current.getJavaType().getName() + "." + parts[i];

            From<?, ?> finalCurrent = current;
            int finalI = i;
            current = (From<?, ?>) joinCache.computeIfAbsent(
                    joinKey,
                    k -> finalCurrent.join(parts[finalI], JoinType.LEFT));
        }

        return current.get(parts[parts.length - 1]);
    }

    @SuppressWarnings({ "unchecked", "rawtypes" })
    private Predicate buildPredicate(
            CriteriaBuilder cb,
            Path<?> path,
            Object value,
            FilterField annotation) {

        FilterOperator op = annotation.operator();

        return switch (op) {

            case EQUAL -> cb.equal(path, value);

            case NOT_EQUAL -> cb.notEqual(path, value);

            case LIKE -> {
                String v = value.toString();
                if (annotation.ignoreCase()) {
                    yield cb.like(cb.lower(path.as(String.class)),
                            "%" + v.toLowerCase() + "%");
                }
                yield cb.like(path.as(String.class), "%" + v + "%");
            }

            case GREATER_THAN -> cb.greaterThan((Path<Comparable>) path, (Comparable) value);

            case LESS_THAN -> cb.lessThan((Path<Comparable>) path, (Comparable) value);

            case GREATER_OR_EQUAL -> cb.greaterThanOrEqualTo((Path<Comparable>) path, (Comparable) value);

            case LESS_OR_EQUAL -> cb.lessThanOrEqualTo((Path<Comparable>) path, (Comparable) value);

            case IN -> path.in((Collection<?>) value);

            case BETWEEN -> {
                List<?> list = (List<?>) value;
                yield cb.between((Path<Comparable>) path,
                        (Comparable) list.get(0),
                        (Comparable) list.get(1));
            }

            case IS_NULL -> cb.isNull(path);

            case IS_NOT_NULL -> cb.isNotNull(path);
        };
    }

    private Object getValue(Field field, Object obj) {
        try {
            return field.get(obj);
        } catch (Exception e) {
            return null;
        }
    }

    private List<Field> getAllFields(Class<?> type) {
        List<Field> fields = new ArrayList<>();

        while (type != null) {
            fields.addAll(Arrays.asList(type.getDeclaredFields()));
            type = type.getSuperclass();
        }
        return fields;
    }
}