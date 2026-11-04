package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassRequest;

import java.util.List;
import java.util.Map;

/**
 * Service interface for fetching and managing data from the external system (hệ thống tổng).
 */
public interface ExternalApiService {

    default boolean isSampleData() {
        return false;
    }

    /**
     * Fetch list of classes from the external system.
     *
     * @param status filter by status (e.g. "active"), nullable for no filter
     * @return list of external classes
     */
    List<ExternalClassDTO> fetchClasses(String status);

    /**
     * Fetch a single class by its ID from the external system.
     *
     * @param id the class ID
     * @return the external class
     */
    ExternalClassDTO fetchClassById(Long id);

    ExternalClassDTO createClass(ExternalClassRequest request);

    ExternalClassDTO updateClass(Long id, ExternalClassRequest request);

    /**
     * Create a new class in the external system.
     *
     * @param dto the class data
     * @return the created external class
     */
    default ExternalClassDTO createClass(ExternalClassDTO dto) {
        Boolean jobRec = null;
        if (dto.getJobRecommendation() instanceof Boolean b) {
            jobRec = b;
        } else if (dto.getJobRecommendation() instanceof String s) {
            jobRec = "yes".equalsIgnoreCase(s) || "true".equalsIgnoreCase(s);
        }
        return createClass(new ExternalClassRequest(
                dto.getCode(), dto.getName(), dto.getStartDate(), dto.getEndDate(),
                dto.getStatus(), dto.getPlannedSize(), dto.getDeliveryType(),
                dto.getTraineeType(), dto.getFormatType(), dto.getSkills(),
                dto.getSite(), dto.getLocation(), dto.getSubjectType(),
                dto.getScope(), dto.getSupplierPartner(), dto.getKeyProgram(),
                jobRec
        ));
    }

    /**
     * Update an existing class in the external system.
     *
     * @param id the class ID
     * @param dto the updated class data
     * @return the updated external class
     */
    default ExternalClassDTO updateClass(Long id, ExternalClassDTO dto) {
        Boolean jobRec = null;
        if (dto.getJobRecommendation() instanceof Boolean b) {
            jobRec = b;
        } else if (dto.getJobRecommendation() instanceof String s) {
            jobRec = "yes".equalsIgnoreCase(s) || "true".equalsIgnoreCase(s);
        }
        return updateClass(id, new ExternalClassRequest(
                dto.getCode(), dto.getName(), dto.getStartDate(), dto.getEndDate(),
                dto.getStatus(), dto.getPlannedSize(), dto.getDeliveryType(),
                dto.getTraineeType(), dto.getFormatType(), dto.getSkills(),
                dto.getSite(), dto.getLocation(), dto.getSubjectType(),
                dto.getScope(), dto.getSupplierPartner(), dto.getKeyProgram(),
                jobRec
        ));
    }

    /**
     * Delete a class in the external system.
     *
     * @param id the class ID
     */
    void deleteClass(Long id);

    /**
     * Batch import classes into the external system.
     *
     * @param dtoList list of classes to import
     * @return import result map
     */
    default Map<String, Object> batchImportClasses(List<ExternalClassDTO> dtoList) {
        return Map.of();
    }

    /**
     * Fetch list of trainers from the external system.
     *
     * @param status filter by status (e.g. "active"), nullable for no filter
     * @return list of external trainers
     */
    List<ExternalTrainerDTO> fetchTrainers(String status);

    /**
     * Fetch list of rooms from the external system.
     *
     * @return list of external rooms
     */
    List<ExternalRoomDTO> fetchRooms();

    // ===================== TRAINEES =====================

    /** Fetch trainees enrolled in a class. */
    default Object fetchClassTrainees(Long classId) { return List.of(); }

    /** Fetch all trainees (pool). */
    default Object fetchAllTrainees() { return List.of(); }

    /** Add a trainee to a class. */
    default Object addTraineeToClass(Long classId, Object body) { return Map.of(); }

    /** Update trainee details in a class. */
    default Object updateClassTrainee(Long classId, Long traineeId, Object body) { return Map.of(); }

    /** Batch save staged trainee changes (create, update, delete) for a class. */
    default Object batchSaveClassTrainees(Long classId, Object body) { return Map.of(); }

    /** Remove a trainee from a class. */
    default Object removeTraineeFromClass(Long classId, Long traineeId, Object body) { return Map.of(); }

    // ===================== STATUS LIFECYCLE =====================

    /** Get status transition info for a class. */
    default Object fetchClassStatusInfo(Long classId) { return Map.of(); }

    /** Transition a class to a new status. */
    default Object transitionClassStatus(Long classId, Object body) { return Map.of(); }

    // ===================== SESSIONS =====================

    /** Fetch sessions for a class. */
    default Object fetchClassSessions(Long classId) { return List.of(); }

    default Object fetchClassCalendars(Long classId) { return List.of(); }
    default Object saveClassCalendars(Long classId, Object body) { return Map.of(); }
    default Object createCalendarVersion(Long classId, Long calendarId, Object body) { return Map.of(); }

    /** Create a session for a class. */
    default Object createClassSession(Long classId, Object body) { return Map.of(); }

    /** Delete a session. */
    default void deleteClassSession(Long classId, Long sessionId) {}

    // ===================== ATTENDANCE =====================

    /** Get attendance for a session. */
    default Object fetchSessionAttendance(Long classId, Long sessionId) { return List.of(); }

    /** Save attendance for a session. */
    default Object saveSessionAttendance(Long classId, Long sessionId, Object body) { return Map.of(); }

    // ===================== BUDGET =====================

    /** Get budget for a class. */
    default Object fetchClassBudget(Long classId) { return Map.of(); }

    // ===================== OPERATION & MILESTONES =====================

    default Object fetchClassOperation(Long classId) { return Map.of(); }
    default Object saveClassOperation(Long classId, Object body) { return Map.of(); }

    // ===================== TOPIC ASSESSMENTS =====================

    default Object fetchTopicAssessments(Long classId) { return Map.of(); }
    default Object saveTopicAssessments(Long classId, Object body) { return Map.of(); }

    // ===================== ACTIVITIES =====================

    default Object fetchClassActivities(Long classId) { return List.of(); }
    default Object addClassActivity(Long classId, Object body) { return Map.of(); }

    // ===================== AUDIT =====================

    /** Get all audit records. */
    default Object fetchAllAudits() { return List.of(); }

    /** Get audits for a class. */
    default Object fetchClassAudits(Long classId) { return List.of(); }

    /** Create an audit record. */
    default Object createAudit(Object body) { return Map.of(); }

    // ===================== ANALYTICS =====================

    /** Get training analytics. */
    default Object fetchAnalytics() { return Map.of(); }
}
