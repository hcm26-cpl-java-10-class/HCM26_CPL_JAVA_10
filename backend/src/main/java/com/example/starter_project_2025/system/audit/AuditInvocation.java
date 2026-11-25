package com.example.starter_project_2025.system.audit;

import java.lang.reflect.Method;

/**
 * Read-only view of one intercepted method call, given to the lambdas of an {@link AuditRule}.
 */
public final class AuditInvocation {

    private final Object[] args;
    private final Object result;
    private final Throwable error;

    public AuditInvocation(Object[] args, Object result, Throwable error) {
        this.args = args != null ? args : new Object[0];
        this.result = result;
        this.error = error;
    }

    public Object arg(int index) {
        return index >= 0 && index < args.length ? args[index] : null;
    }

    public Object argProp(int index, String property) {
        return prop(arg(index), property);
    }

    public Object result() {
        return result;
    }

    public Object resultProp(String property) {
        return prop(result, property);
    }

    public Throwable error() {
        return error;
    }

    public boolean failed() {
        return error != null;
    }

    /**
     * Reads a property through its getter (getX / isX / x()); returns null when it is not available.
     */
    public static Object prop(Object source, String property) {
        if (source == null || property == null || property.isBlank()) {
            return null;
        }

        String suffix = Character.toUpperCase(property.charAt(0)) + property.substring(1);
        String[] candidates = {"get" + suffix, "is" + suffix, property};

        for (String name : candidates) {
            try {
                Method getter = source.getClass().getMethod(name);
                getter.setAccessible(true);
                return getter.invoke(source);
            } catch (Exception ignored) {
                // try the next naming convention
            }
        }

        return null;
    }
}
