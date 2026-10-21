package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;

import java.util.List;

/**
 * Service interface for fetching data from the external system (hệ thống tổng).
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
}
