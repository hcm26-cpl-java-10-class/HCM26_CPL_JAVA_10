package com.example.starter_project_2025.base.dataio.exporter.resolver;

import com.example.starter_project_2025.base.dataio.exporter.metadata.ExportFieldMeta;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.util.Collection;
import java.util.Objects;
import java.util.stream.Collectors;

@Component
public class RelationResolverEngine {

    public Object resolve(Object value, ExportFieldMeta meta) {

        if (value == null) return "";

        if (value instanceof Collection<?> col) {
            return col.stream()
                    .map(item -> resolvePath(item, meta.path()))
                    .filter(Objects::nonNull)
                    .map(Object::toString)
                    .collect(Collectors.joining(meta.separator()));
        }

        return resolvePath(value, meta.path());
    }

    private Object resolvePath(Object obj, String path) {

        if (obj == null || path.isBlank())
            return obj;

        try {
            // Lazy associations may hand us a Hibernate proxy. A proxy is a generated subclass that has
            // none of the entity's fields, so reading "code" or "name" from it used to fail and the
            // whole export came out empty. Unwrap it to the real entity first.
            Object current = Hibernate.unproxy(obj);

            for (String part : path.split("\\.")) {
                Field f = findField(current.getClass(), part);
                f.setAccessible(true);
                current = Hibernate.unproxy(f.get(current));

                if (current == null) return null;
            }

            return current;

        } catch (Exception e) {
            throw new RuntimeException("Cannot resolve relation path: " + path, e);
        }
    }

    /** Looks in the class and its parents (for example BaseEntity holds id and audit fields). */
    private Field findField(Class<?> type, String name) throws NoSuchFieldException {
        Class<?> current = type;
        while (current != null && current != Object.class) {
            try {
                return current.getDeclaredField(name);
            } catch (NoSuchFieldException ignored) {
                current = current.getSuperclass();
            }
        }
        throw new NoSuchFieldException(name);
    }
}
