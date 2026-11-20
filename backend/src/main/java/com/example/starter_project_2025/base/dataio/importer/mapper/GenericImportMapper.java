
package com.example.starter_project_2025.base.dataio.importer.mapper;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.PostImport;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationGraphBuilder;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationLookupEngine;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;

import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class GenericImportMapper {

    RelationLookupEngine relationEngine;
    RelationGraphBuilder graphBuilder;
    ValueConverter converter;

    public <T> T map(Map<String, String> rowData, Class<T> clazz) {

        try {
            T entity = clazz.getDeclaredConstructor().newInstance();

            // Đọc cả field của class cha
            for (Field field : getAllFields(clazz)) {

                field.setAccessible(true);

                ImportField meta = field.getAnnotation(ImportField.class);

                if (meta == null) {
                    continue;
                }

                String raw = rowData.get(meta.name());

                if (meta.required() && (raw == null || raw.isBlank())) {
                    throw new RuntimeException("Missing: " + meta.name());
                }

                if (raw == null || raw.isBlank()) {
                    continue;
                }

                if (!meta.relationPath().isBlank()) {
                    graphBuilder.buildRelation(entity, field, meta, raw);
                    continue;
                }

                if (meta.lookupEntity() != Void.class) {
                    field.set(
                            entity,
                            relationEngine.resolve(raw, field, meta)
                    );
                    continue;
                }

                field.set(
                        entity,
                        converter.convert(field.getType(), raw)
                );
            }

            runPostImportHooks(entity);

            return entity;

        } catch (Exception e) {
            throw new RuntimeException(e.getMessage(), e);
        }
    }

    private List<Field> getAllFields(Class<?> clazz) {

        List<Field> fields = new ArrayList<>();

        Class<?> current = clazz;

        while (current != null && current != Object.class) {

            for (Field field : current.getDeclaredFields()) {
                fields.add(field);
            }

            current = current.getSuperclass();
        }

        return fields;
    }

    private void runPostImportHooks(Object entity) {

        Class<?> current = entity.getClass();

        while (current != null && current != Object.class) {

            for (var method : current.getDeclaredMethods()) {

                if (method.isAnnotationPresent(PostImport.class)) {

                    try {
                        method.setAccessible(true);
                        method.invoke(entity);

                    } catch (Exception e) {
                        throw new RuntimeException(
                                "PostImport failed: " + method.getName(),
                                e
                        );
                    }
                }
            }

            current = current.getSuperclass();
        }
    }
}
