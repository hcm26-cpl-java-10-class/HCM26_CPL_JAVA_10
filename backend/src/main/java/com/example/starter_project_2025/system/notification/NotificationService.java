package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    /** Optional so the two-argument constructor used by older tests keeps working; null means "no preferences". */
    @Autowired(required = false)
    private NotificationPreferenceRepository preferenceRepository;

    @Transactional(readOnly = true)
    public NotificationListDTO getForUser(Long userId) {
        return new NotificationListDTO(
                notificationRepository.findTop30ByUser_IdOrderByCreatedAtDesc(userId)
                        .stream()
                        .map(NotificationDTO::from)
                        .toList(),
                notificationRepository.countByUser_IdAndReadAtIsNull(userId)
        );
    }

    @Transactional
    public void createOnce(Long userId, String eventKey, String title, String message, String targetUrl) {
        if (notificationRepository.existsByEventKey(eventKey)) {
            notificationRepository.updateTargetUrlByEventKey(eventKey, targetUrl);
            return;
        }
        NotificationCategory category = NotificationCategory.fromEventKey(eventKey);
        if (!isInAppEnabled(userId, category)) {
            return;
        }
        notificationRepository.save(Notification.builder()
                .user(userRepository.getReferenceById(userId))
                .eventKey(eventKey)
                .title(title)
                .message(message)
                .targetUrl(targetUrl)
                .category(category)
                .build());
    }

    @Transactional
    public void markRead(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndUser_Id(notificationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
        }
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllRead(userId, LocalDateTime.now());
    }

    @Transactional(readOnly = true)
    public NotificationPageDTO getPage(Long userId, NotificationCategory category, boolean unreadOnly, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest request = PageRequest.of(Math.max(page, 0), safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));
        Page<Notification> result;
        if (category == null) {
            result = unreadOnly
                    ? notificationRepository.findByUser_IdAndReadAtIsNull(userId, request)
                    : notificationRepository.findByUser_Id(userId, request);
        } else {
            result = unreadOnly
                    ? notificationRepository.findByUser_IdAndCategoryAndReadAtIsNull(userId, category, request)
                    : notificationRepository.findByUser_IdAndCategory(userId, category, request);
        }
        Map<NotificationCategory, Long> byCategory = unreadByCategory(userId);
        long unread = byCategory.values().stream().mapToLong(Long::longValue).sum();
        return new NotificationPageDTO(
                result.getContent().stream().map(NotificationDTO::from).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages(),
                unread, byCategory);
    }

    @Transactional(readOnly = true)
    public Map<NotificationCategory, Long> unreadByCategory(Long userId) {
        Map<NotificationCategory, Long> counts = new EnumMap<>(NotificationCategory.class);
        for (NotificationCategory category : NotificationCategory.values()) {
            counts.put(category, 0L);
        }
        for (Object[] row : notificationRepository.countUnreadByCategory(userId)) {
            NotificationCategory category = row[0] == null ? NotificationCategory.SYSTEM : (NotificationCategory) row[0];
            counts.merge(category, (Long) row[1], Long::sum);
        }
        return counts;
    }

    @Transactional
    public void delete(Long userId, Long notificationId) {
        if (notificationRepository.deleteOwned(notificationId, userId) == 0) {
            throw new ResourceNotFoundException("Notification not found");
        }
    }

    @Transactional
    public int deleteRead(Long userId) {
        return notificationRepository.deleteRead(userId);
    }

    @Transactional(readOnly = true)
    public List<NotificationPreferenceDTO> getPreferences(Long userId) {
        Map<NotificationCategory, Boolean> stored = new EnumMap<>(NotificationCategory.class);
        if (preferenceRepository != null) {
            preferenceRepository.findByUser_Id(userId)
                    .forEach(p -> stored.put(p.getCategory(), p.isInAppEnabled()));
        }
        return java.util.Arrays.stream(NotificationCategory.values())
                .map(c -> new NotificationPreferenceDTO(c, stored.getOrDefault(c, true)))
                .toList();
    }

    @Transactional
    public List<NotificationPreferenceDTO> updatePreferences(Long userId, List<NotificationPreferenceDTO> changes) {
        if (preferenceRepository == null || changes == null) {
            return getPreferences(userId);
        }
        for (NotificationPreferenceDTO change : changes) {
            if (change == null || change.category() == null) {
                continue;
            }
            NotificationPreference row = preferenceRepository.findByUser_IdAndCategory(userId, change.category())
                    .orElseGet(() -> NotificationPreference.builder()
                            .user(userRepository.getReferenceById(userId))
                            .category(change.category())
                            .build());
            row.setInAppEnabled(change.inAppEnabled());
            preferenceRepository.save(row);
        }
        return getPreferences(userId);
    }

    /** One-off at startup: give old rows a category derived from their event key. */
    @Transactional
    public int backfillCategories() {
        List<Notification> rows = notificationRepository.findByCategoryIsNull();
        rows.forEach(n -> n.setCategory(NotificationCategory.fromEventKey(n.getEventKey())));
        return rows.size();
    }

    private boolean isInAppEnabled(Long userId, NotificationCategory category) {
        if (preferenceRepository == null) {
            return true;
        }
        return preferenceRepository.findByUser_IdAndCategory(userId, category)
                .map(NotificationPreference::isInAppEnabled)
                .orElse(true);
    }
}
