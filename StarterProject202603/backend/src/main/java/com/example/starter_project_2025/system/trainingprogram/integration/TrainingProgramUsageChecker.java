package com.example.trainingprogram.integration;

/**
 * Connect this interface to the Class module before enabling physical deletion.
 * Return true when one or more classes reference the program.
 */
public interface TrainingProgramUsageChecker {
    boolean isUsedByAnyClass(Long programId);
}
