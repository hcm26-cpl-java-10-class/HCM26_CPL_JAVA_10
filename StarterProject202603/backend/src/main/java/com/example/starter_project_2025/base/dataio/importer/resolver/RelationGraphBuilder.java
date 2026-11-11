package com.example.starter_project_2025.base.dataio.importer.resolver;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.parser.RelationPathParser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;

@Component
@RequiredArgsConstructor
public class RelationGraphBuilder {

    private final RelationLookupEngine lookupEngine;
    private final RelationPathParser parser;

    public void buildRelation(
            Object parent,
            Field parentField,
            ImportField meta,
            String raw) throws Exception {

        List<String> path = parser.parse(meta.relationPath());

        Collection<Object> collection = getCollection(parent, parentField);

        for (String val : raw.split(meta.separator())) {

            Object chain = buildChain(parent, path, meta, val.trim());

            collection.add(chain);
        }
    }

    private Object buildChain(
            Object root,
            List<String> path,
            ImportField meta,
            String value) throws Exception {

        Object current = root;
        Class<?> currentClass = root.getClass();

        for (int i = 0; i < path.size(); i++) {

            Field field = currentClass.getDeclaredField(path.get(i));
            field.setAccessible(true);

            if (i == path.size() - 1) {
                Object target = lookupEngine.resolveSingle(
                        value,
                        meta.lookupEntity(),
                        meta.lookupField());
                field.set(current, target);
                return current;
            }

            Object child = field.getType().getDeclaredConstructor().newInstance();

            setBackReference(child, current);

            field.set(current, child);

            current = child;
            currentClass = child.getClass();
        }

        return current;
    }

    @SuppressWarnings("unchecked")
    private Collection<Object> getCollection(Object parent, Field field)
            throws Exception {

        field.setAccessible(true);

        Collection<Object> col = (Collection<Object>) field.get(parent);

        if (col == null) {
            col = new HashSet<>();
            field.set(parent, col);
        }

        return col;
    }

    private void setBackReference(Object child, Object parent) {
        for (Field f : child.getClass().getDeclaredFields()) {
            if (f.getType().equals(parent.getClass())) {
                try {
                    f.setAccessible(true);
                    f.set(child, parent);
                } catch (Exception ignored) {
                }
            }
        }
    }
}