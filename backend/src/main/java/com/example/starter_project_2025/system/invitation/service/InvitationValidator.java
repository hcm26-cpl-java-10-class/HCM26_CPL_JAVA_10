package com.example.starter_project_2025.system.invitation.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.invitation.domain.Invitation;
import com.example.starter_project_2025.system.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.invitation.dto.InvitationDTO;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InvitationValidator {

    private final ExamRepository examRepository;
    private final UserRepository userRepository;
    private final InvitationRepository invitationRepository;

    public void validateForCreate(InvitationDTO request, ValidationContext ctx) {
        if (request.getExamId() == null) {
            ctx.add("examId", "ID kỳ thi không được để trống");
            return;
        }

        if (request.getUserId() == null) {
            ctx.add("userId", "ID người dùng không được để trống");
            return;
        }

        Exam exam = examRepository.findById(request.getExamId()).orElse(null);
        if (exam == null) {
            ctx.add("examId", "Không tìm thấy kỳ thi với ID: " + request.getExamId());
            return;
        }

        if (!Boolean.TRUE.equals(exam.getIsActive())) {
            ctx.add("examId", "Kỳ thi đã bị vô hiệu hóa, không thể tạo lời mời");
            return;
        }

        User user = userRepository.findById(request.getUserId()).orElse(null);
        if (user == null) {
            ctx.add("userId", "Không tìm thấy người dùng với ID: " + request.getUserId());
            return;
        }

        validateUserEligibility(user, ctx);

        if (invitationRepository.existsByExamIdAndUserId(request.getExamId(), request.getUserId())) {
            ctx.add("invitation", "Lời mời cho người dùng này đã tồn tại trong kỳ thi");
        }
    }

    public void validateForUpdate(Invitation existing, InvitationDTO request, ValidationContext ctx) {
        if (request.getExamId() != null && existing.getExam() != null
                && !request.getExamId().equals(existing.getExam().getId())) {
            ctx.add("examId", "Không được phép thay đổi kỳ thi của lời mời");
        }

        if (request.getUserId() != null && existing.getUser() != null
                && !request.getUserId().equals(existing.getUser().getId())) {
            ctx.add("userId", "Không được phép thay đổi người được mời");
        }
    }

    public void validateUserEligibility(User user, ValidationContext ctx) {
        if (!Boolean.TRUE.equals(user.getIsActive())) {
            ctx.add("userId", "Người dùng đã bị vô hiệu hóa, không đủ điều kiện tham gia kỳ thi");
            return;
        }

        boolean isStudent = user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "STUDENT".equalsIgnoreCase(r.getName()));

        if (!isStudent) {
            ctx.add("userId", "Người dùng không có vai trò học sinh (STUDENT), không đủ điều kiện tham gia kỳ thi");
        }
    }
}
