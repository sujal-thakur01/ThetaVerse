package com.interview.backend.config;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.stream.Collectors;

@Aspect
@Component
@Order(1)
public class BackendExecutionLoggingAspect {

    @Around("within(com.interview.backend.controller..*) || within(com.interview.backend.service..*)")
    public Object logExecution(ProceedingJoinPoint joinPoint) throws Throwable {
        String signature = joinPoint.getSignature().toShortString();
        String arguments = Arrays.stream(joinPoint.getArgs())
                .map(this::describeArgument)
                .collect(Collectors.joining(", "));
        long startedAt = System.currentTimeMillis();

        System.out.println("[Backend] START " + signature + "(" + arguments + ")");

        try {
            Object result = joinPoint.proceed();
            long duration = System.currentTimeMillis() - startedAt;
            System.out
                    .println("[Backend] END " + signature + " -> " + describeResult(result) + " (" + duration + " ms)");
            return result;
        } catch (Throwable error) {
            long duration = System.currentTimeMillis() - startedAt;
            System.err.println("[Backend] FAIL " + signature + " after " + duration + " ms: " + error.getMessage());
            throw error;
        }
    }

    private String describeArgument(Object argument) {
        if (argument == null) {
            return "null";
        }

        return argument.getClass().getSimpleName();
    }

    private String describeResult(Object result) {
        if (result == null) {
            return "null";
        }

        return result.getClass().getSimpleName();
    }
}