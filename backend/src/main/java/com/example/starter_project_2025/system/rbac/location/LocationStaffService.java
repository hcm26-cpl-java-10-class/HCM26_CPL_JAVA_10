package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class LocationStaffService {

    private final LocationRepository locationRepository;
    private final UserRepository userRepository;
    private final LocationSecurity locationSecurity;

    public record AssignRequest(Set<Long> userIds) {}

    public record StaffCandidate(
            Long id,
            String email,
            String fullName,
            String employeeCode,
            String roleName
    ) {}

    @Transactional(readOnly = true)
    public List<StaffCandidate> findAssignableUsers(Long locationId, String search) {
        locationSecurity.check(CrudAction.UPDATE);
        Location location = findLocation(locationId);

        String normalized = search == null ? "" : search.trim().toLowerCase();
        return userRepository.findAll().stream()
                .filter(User::getIsActive)
                .filter(user -> !Boolean.TRUE.equals(user.getLocked()))
                .filter(user -> !location.getUsers().contains(user))
                .filter(user -> matches(user, normalized))
                .sorted((left, right) -> left.getFullName().compareToIgnoreCase(right.getFullName()))
                .limit(100)
                .map(this::toCandidate)
                .toList();
    }

    @Transactional
    public void assignUsers(Long locationId, AssignRequest request) {
        locationSecurity.check(CrudAction.UPDATE);
        Location location = findLocation(locationId);
        ensureActive(location);

        if (request == null || request.userIds() == null || request.userIds().isEmpty()) {
            throw new BadRequestException("Select at least one staff member.");
        }

        for (Long userId : request.userIds()) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
            if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getLocked())) {
                throw new BadRequestException("Inactive or locked users cannot be assigned.");
            }
            if (location.getUsers().contains(user)) {
                throw new BadRequestException("One or more users are already assigned to this location.");
            }
            location.addUser(user);
        }
        locationRepository.save(location);
    }

    @Transactional
    public void unassignUser(Long locationId, Long userId) {
        locationSecurity.check(CrudAction.UPDATE);
        Location location = findLocation(locationId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        if (!location.getUsers().contains(user)) {
            throw new BadRequestException("This user is not assigned to the location.");
        }
        location.removeUser(user);
        locationRepository.save(location);
    }

    private Location findLocation(Long locationId) {
        return locationRepository.findById(locationId)
                .orElseThrow(() -> new ResourceNotFoundException("Location", "id", locationId));
    }

    private void ensureActive(Location location) {
        if (location.getStatus() == LocationStatus.INACTIVE) {
            throw new BadRequestException("Cannot assign staff to an inactive location.");
        }
    }

    private boolean matches(User user, String search) {
        if (search.isBlank()) return true;
        String fullName = user.getFullName() == null ? "" : user.getFullName().toLowerCase();
        String email = user.getEmail() == null ? "" : user.getEmail().toLowerCase();
        String employeeCode = user.getEmployeeCode() == null ? "" : user.getEmployeeCode().toLowerCase();
        return fullName.contains(search) || email.contains(search) || employeeCode.contains(search);
    }

    private StaffCandidate toCandidate(User user) {
        String roleName = user.getRoles() == null || user.getRoles().isEmpty()
                ? null
                : user.getRoles().iterator().next().getName();
        return new StaffCandidate(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getEmployeeCode(),
                roleName
        );
    }
}
