package com.example.starter_project_2025.base.dataio.importer.resolver;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.context.ApplicationContext;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RelationLookupEngine {

    ApplicationContext ctx;

    /** Roles, departments... already looked up during the running import (one query per distinct value). */
    private static final ThreadLocal<Map<List<Object>, Object>> CACHE = new ThreadLocal<>();

    /** Start remembering lookups on this thread. Call {@link #endCache()} when the import is over. */
    public void startCache() {
        CACHE.set(new HashMap<>());
    }

    public void endCache() {
        CACHE.remove();
    }

    public Object resolveSingle(String value, Class<?> entity, String field) {

        JpaRepository<?, ?> repo = getRepository(entity);

        return findEntity(repo, field, value);
    }

    public Object resolve(String raw, Field field, ImportField meta) {

        if (raw == null || raw.isBlank())
            return null;

        JpaRepository<?, ?> repo = getRepository(meta.lookupEntity());

        if (Collection.class.isAssignableFrom(field.getType())) {

            Collection<Object> result = Set.class.isAssignableFrom(field.getType())
                    ? new HashSet<>()
                    : new ArrayList<>();

            for (String val : raw.split(meta.separator())) {
                result.add(findEntity(repo, meta.lookupField(), val.trim()));
            }

            return result;
        }

        return findEntity(repo, meta.lookupField(), raw.trim());
    }

    private Object findEntity(JpaRepository<?, ?> repo, String field, String value) {

        Map<List<Object>, Object> cache = CACHE.get();
        if (cache == null) {
            return findEntityUncached(repo, field, value);
        }

        List<Object> key = List.of(System.identityHashCode(repo), field, value);
        Object known = cache.get(key);
        if (known != null) {
            return known;
        }

        Object found = findEntityUncached(repo, field, value);
        cache.put(key, found);
        return found;
    }

    private Object findEntityUncached(JpaRepository<?, ?> repo, String field, String value) {

        String methodName = "findBy" + capitalize(field);
        Object result;

        try {
            // Upper and lower case do not matter ("it" finds the department IT) when the repository
            // offers findBy<Field>IgnoreCase; otherwise the exact match is used.
            Method m;
            try {
                m = repo.getClass().getMethod(methodName + "IgnoreCase", String.class);
            } catch (NoSuchMethodException noIgnoreCase) {
                m = repo.getClass().getMethod(methodName, String.class);
            }
            result = m.invoke(repo, value);
        } catch (NoSuchMethodException e) {
            throw new RuntimeException(
                    "Repository is missing method " + methodName + "(String)", e);
        } catch (Exception e) {
            throw new RuntimeException("Lookup failed: " + value, e);
        }

        if (result instanceof Optional<?> opt) {
            return opt.orElseThrow(() -> new RuntimeException(
                    "Not found: " + field + " = '" + value + "'"));
        }

        if (result == null) {
            throw new RuntimeException(
                    "Not found: " + field + " = '" + value + "'");
        }

        return result;
    }

    private JpaRepository<?, ?> getRepository(Class<?> entity) {

        String beanName = Character.toLowerCase(entity.getSimpleName().charAt(0))
                + entity.getSimpleName().substring(1)
                + "Repository";

        return ctx.getBean(beanName, JpaRepository.class);
    }

    private String capitalize(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
