package com.example.starter_project_2025.base.dataio.exporter.metadata;

import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ExportMetadataCache {

    Map<Class<?>, List<ExportFieldMeta>> cache = new ConcurrentHashMap<>();

    public List<ExportFieldMeta> getMetadata(Class<?> clazz) {
        return cache.computeIfAbsent(clazz, this::scan);
    }

    private List<ExportFieldMeta> scan(Class<?> clazz) {

        List<ExportFieldMeta> metas = new ArrayList<>();

        for (Field field : clazz.getDeclaredFields()) {

            ExportField ann = field.getAnnotation(ExportField.class);

            if (ann == null || ann.ignore())
                continue;

            field.setAccessible(true);

            metas.add(ExportFieldMeta.builder()
                    .header(ann.name())
                    .field(field)
                    .dateFormat(ann.dateFormat())
                    .path(ann.path())
                    .relation(ann.relation())
                    .separator(ann.separator())
                    .build());
        }

        return metas;
    }
}
