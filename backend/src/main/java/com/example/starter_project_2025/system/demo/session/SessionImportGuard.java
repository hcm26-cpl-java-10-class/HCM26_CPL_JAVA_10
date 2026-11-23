package com.example.starter_project_2025.system.demo.session;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Component;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;

/**
 * Keeps the generic file importer (parser, row mapping, row-by-row writer and per-row error report) exactly as it
 * is, but makes sure it cannot write a session that the normal create endpoint would have refused: the repository
 * the importer saves through validates each row first. A rejected row is reported by the importer as a failed row.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionImportGuard {

    SessionService sessionService;

    /** A new guarded view of the repository; it remembers master-system lookups, so use it for one import only. */
    @SuppressWarnings("unchecked")
    public JpaRepository<Session, Long> guard(SessionRepository delegate) {
        SessionContextVerifier.Memo memo = new SessionContextVerifier.Memo();

        return (JpaRepository<Session, Long>) Proxy.newProxyInstance(
                JpaRepository.class.getClassLoader(),
                new Class<?>[]{JpaRepository.class},
                (proxy, method, args) -> {
                    if ("save".equals(method.getName()) && args != null && args.length == 1 && args[0] instanceof Session session) {
                        sessionService.validateImportRow(session, memo);
                    }
                    try {
                        return method.invoke(delegate, args);
                    } catch (InvocationTargetException ex) {
                        throw ex.getCause();
                    }
                });
    }
}
