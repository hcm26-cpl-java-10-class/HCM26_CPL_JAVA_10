package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;

import java.util.List;

public interface ExternalApiService {

    List<ExternalClassDTO> fetchClasses(String status);

    ExternalClassDTO fetchClassById(Long id);

    List<ExternalTrainerDTO> fetchTrainers(String status);

    List<ExternalRoomDTO> fetchRooms();
}
