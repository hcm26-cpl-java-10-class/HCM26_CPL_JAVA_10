package com.example.starter_project_2025.system.rbac.user;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

/**
 * Tiny stand-ins for Spring beans, built with plain JDK proxies (no Mockito), so the tests do not
 * depend on bytecode generation and run on any Java version.
 */
final class TestStubs {

    private TestStubs() {
    }

    /** Creates an implementation of the interface. Unlisted methods return an "empty" value. */
    static <T> T stub(Class<T> type, Map<String, Function<Object[], Object>> behaviour) {
        Object proxy = Proxy.newProxyInstance(
                type.getClassLoader(),
                new Class<?>[]{type},
                (self, method, args) -> {
                    if (method.getDeclaringClass() == Object.class) {
                        return switch (method.getName()) {
                            case "hashCode" -> System.identityHashCode(self);
                            case "equals" -> self == args[0];
                            default -> type.getSimpleName() + " stub";
                        };
                    }
                    Function<Object[], Object> handler = behaviour.get(method.getName());
                    if (handler != null) {
                        return handler.apply(args == null ? new Object[0] : args);
                    }
                    return emptyValue(method.getReturnType());
                });
        return type.cast(proxy);
    }

    static <T> T stub(Class<T> type) {
        return stub(type, Map.of());
    }

    private static Object emptyValue(Class<?> type) {
        if (type == Optional.class) return Optional.empty();
        if (type == boolean.class) return false;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        if (type == List.class) return List.of();
        if (type == Set.class) return Set.of();
        return null;
    }
}
