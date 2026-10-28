package com.example.starter_project_2025.system.rbac.user;

/**
 * Kind of account. It decides how the employee code is handled:
 * internal staff must have one, students and external staff may leave it empty.
 */
public enum UserType {
    STUDENT,
    INTERNAL_STAFF,
    EXTERNAL_STAFF
}
