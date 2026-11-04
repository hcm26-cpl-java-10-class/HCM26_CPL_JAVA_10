package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;

import java.util.List;
import java.util.Map;

/**
 * Service interface for fetching and managing data from the external system (hệ thống tổng).
 */
public interface ExternalApiService {

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

    /**
     * Create a new class in the external system.
     *
     * @param dto the class data
     * @return the created external class
     */
    ExternalClassDTO createClass(ExternalClassDTO dto);

    /**
     * Update an existing class in the external system.
     *
     * @param id the class ID
     * @param dto the updated class data
     * @return the updated external class
     */
    ExternalClassDTO updateClass(Long id, ExternalClassDTO dto);

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
    Map<String, Object> batchImportClasses(List<ExternalClassDTO> dtoList);

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
    Object fetchClassTrainees(Long classId);

    /** Fetch all trainees (pool). */
    Object fetchAllTrainees();

    /** Add a trainee to a class. */
    Object addTraineeToClass(Long classId, Object body);

    /** Update trainee details in a class. */
    Object updateClassTrainee(Long classId, Long traineeId, Object body);

    /** Batch save staged trainee changes (create, update, delete) for a class. */
    Object batchSaveClassTrainees(Long classId, Object body);

    /** Remove a trainee from a class. */
    Object removeTraineeFromClass(Long classId, Long traineeId, Object body);

    // ===================== STATUS LIFECYCLE =====================

    /** Get status transition info for a class. */
    Object fetchClassStatusInfo(Long classId);

    /** Transition a class to a new status. */
    Object transitionClassStatus(Long classId, Object body);

    // ===================== SESSIONS =====================

    /** Fetch sessions for a class. */
    Object fetchClassSessions(Long classId);

    Object fetchClassCalendars(Long classId);
    Object saveClassCalendars(Long classId, Object body);
    Object createCalendarVersion(Long classId, Long calendarId, Object body);

    /** Create a session for a class. */
    Object createClassSession(Long classId, Object body);

    /** Delete a session. */
    void deleteClassSession(Long classId, Long sessionId);

    // ===================== ATTENDANCE =====================

    /** Get attendance for a session. */
    Object fetchSessionAttendance(Long classId, Long sessionId);

    /** Save attendance for a session. */
    Object saveSessionAttendance(Long classId, Long sessionId, Object body);

    // ===================== BUDGET =====================

    /** Get budget for a class. */
    Object fetchClassBudget(Long classId);

    // ===================== AUDIT =====================

    /** Get all audit records. */
    Object fetchAllAudits();

    /** Get audits for a class. */
    Object fetchClassAudits(Long classId);

    /** Create an audit record. */
    Object createAudit(Object body);

    // ===================== ANALYTICS =====================

    /** Get training analytics. */
    Object fetchAnalytics();
}
