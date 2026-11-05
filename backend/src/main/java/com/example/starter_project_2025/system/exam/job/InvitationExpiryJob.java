package com.example.starter_project_2025.system.exam.job;

import com.example.starter_project_2025.system.exam.domain.Invitation;
import com.example.starter_project_2025.system.exam.domain.InvitationRepository;
import com.example.starter_project_2025.system.exam.domain.InvitationStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class InvitationExpiryJob {

    private final InvitationRepository invitationRepository;

    @Scheduled(fixedRateString = "${app.invitation.expiry-interval-ms:300000}")
    @Transactional
    public void expireInvitations() {
        try {
            LocalDateTime now = LocalDateTime.now();
            List<Invitation> expired = invitationRepository.findAllExpiredPendingInvitations(now);

            if (expired.isEmpty()) {
                return;
            }

            for (Invitation invitation : expired) {
                invitation.setStatus(InvitationStatus.EXPIRED);
            }
            invitationRepository.saveAll(expired);

            log.info("InvitationExpiryJob expired {} invitation(s)", expired.size());
        } catch (Exception e) {
            log.error("InvitationExpiryJob failed: {}", e.getMessage(), e);
        }
    }
}