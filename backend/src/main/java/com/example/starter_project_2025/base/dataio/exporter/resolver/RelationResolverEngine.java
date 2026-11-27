package com.example.starter_project_2025.base.dataio.exporter.resolver;

import com.example.starter_project_2025.base.dataio.exporter.metadata.ExportFieldMeta;
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
            Object current = obj;

            for (String part : path.split("\\.")) {
                Field f = current.getClass().getDeclaredField(part);
                f.setAccessible(true);
                current = f.get(current);

                if (current == null) return null;
            }

            return current;

        } catch (Exception e) {
            throw new RuntimeException("Cannot resolve relation path: " + path, e);
        }
    }
}
