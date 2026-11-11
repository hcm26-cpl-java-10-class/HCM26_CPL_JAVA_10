package com.example.starter_project_2025.system.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.aopalliance.aop.Advice;
import org.springframework.aop.Pointcut;
import org.springframework.aop.support.AbstractPointcutAdvisor;
import org.springframework.aop.support.StaticMethodMatcherPointcut;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.Role;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;

/**
 * Applies the audit interceptor to exactly the methods that have a rule.
 * Only beans that own such a method are proxied, so other services are not affected.
 */
@Component
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@SuppressWarnings("serial")
public class AuditRuleAdvisor extends AbstractPointcutAdvisor {

    private final transient Pointcut pointcut;
    private final transient Advice advice;

    public AuditRuleAdvisor(
            AuditRuleRegistry registry,
            ObjectProvider<AuditLogService> auditLogService,
            ObjectProvider<ObjectMapper> objectMapper
    ) {
        this.pointcut = new StaticMethodMatcherPointcut() {
            @Override
            public boolean matches(Method method, Class<?> targetClass) {
                return registry.find(targetClass, method).isPresent();
            }
        };

        this.advice = new AuditRuleInterceptor(registry, auditLogService, objectMapper);
    }

    @Override
    public Pointcut getPointcut() {
        return pointcut;
    }

    @Override
    public Advice getAdvice() {
        return advice;
    }
}
