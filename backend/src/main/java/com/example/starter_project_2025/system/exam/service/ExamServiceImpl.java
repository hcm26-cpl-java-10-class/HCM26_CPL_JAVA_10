package com.example.starter_project_2025.system.exam.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamReminder;
import com.example.starter_project_2025.system.exam.domain.ExamType;
import com.example.starter_project_2025.system.exam.domain.ExamReminderRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.Invitation;
import com.example.starter_project_2025.system.exam.domain.InvitationRepository;
import com.example.starter_project_2025.system.exam.domain.InvitationStatus;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamFilter;
import com.example.starter_project_2025.system.exam.dto.ExamInvitationOverviewDTO;
import com.example.starter_project_2025.system.exam.mapper.ExamMapper;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.EssayGradingCriterion;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.mapper.QuestionMapper;
import com.example.starter_project_2025.system.question.service.QuestionValidator;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ExamServiceImpl extends BaseCrudServiceImpl<Exam, Long, ExamDTO, ExamFilter> {

	private final ExamRepository examRepository;
	private final QuestionRepository questionRepository;
	private final ExamMapper examMapper;
	private final ExamConfigValidator configValidator;
	private final ExamAttemptRepository examAttemptRepository;
	private final InvitationRepository invitationRepository;
	private final ExamReminderRepository examReminderRepository;
	private final QuestionMapper questionMapper;
	private final QuestionValidator questionValidator;
	private final ExamAccessGuard examAccessGuard;
	private final ExamCourseLinkService courseLinkService;

	@Override
	protected BaseCrudRepository<Exam, Long> getRepository() {
		return examRepository;
	}

	@Override
	protected BaseCrudMapper<Exam, ExamDTO> getMapper() {
		return examMapper;
	}

	@Override
	protected String[] searchableFields() {
		return new String[]{"title"};
	}

	/**
	 * Tổng quan số lượng lời mời của các đề thi mà giáo viên sở hữu.
	 * Dùng cho trang "/invitations" của giáo viên (admin thấy tất cả).
	 */
	public List<ExamInvitationOverviewDTO> listInvitationOverviews(UserPrincipal principal) {
		List<Exam> exams = examRepository.findAll().stream()
				.filter(exam -> examAccessGuard.canManage(exam, principal))
				.toList();

		return exams.stream()
				.map(exam -> {
					List<Invitation> invitations = invitationRepository.findByExamId(exam.getId());
					Map<InvitationStatus, Long> counts = invitations.stream()
							.collect(Collectors.groupingBy(Invitation::getStatus, Collectors.counting()));
					long anonymous = invitations.stream()
							.filter(i -> Boolean.TRUE.equals(i.getAnonymous()))
							.count();

					return ExamInvitationOverviewDTO.builder()
							.examId(exam.getId())
							.examTitle(exam.getTitle())
							.total(invitations.size())
							.pending(counts.getOrDefault(InvitationStatus.PENDING, 0L).intValue())
							.sent(counts.getOrDefault(InvitationStatus.SENT, 0L).intValue())
							.accepted(counts.getOrDefault(InvitationStatus.ACCEPTED, 0L).intValue())
							.rejected(counts.getOrDefault(InvitationStatus.REJECTED, 0L).intValue())
							.expired(counts.getOrDefault(InvitationStatus.EXPIRED, 0L).intValue())
							.revoked(counts.getOrDefault(InvitationStatus.REVOKED, 0L).intValue())
							.completed(counts.getOrDefault(InvitationStatus.COMPLETED, 0L).intValue())
							.anonymous((int) anonymous)
							.build();
				})
				.filter(dto -> dto.getTotal() != null && dto.getTotal() > 0)
				.sorted(Comparator.comparing(ExamInvitationOverviewDTO::getExamId, Comparator.reverseOrder()))
				.toList();
	}

	@Override
	public void delete(Long id) {
		checkPermission(CrudAction.DELETE);

		Exam exam = examRepository.lockForAttemptStart(id)
				.orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
		checkOwnership(exam);

		beforeDelete(exam);

		examRepository.delete(exam);

		afterDelete(exam);
	}

	@Override
	protected void beforeDelete(Exam exam) {
		if (examAttemptRepository.existsByExam_IdAndStatusIn(
				exam.getId(),
				List.of(ExamAttemptStatus.NOT_STARTED, ExamAttemptStatus.IN_PROGRESS))) {
			throw new BadRequestException("Cannot delete an exam that is currently in progress with active student attempts");
		}
		if (examAttemptRepository.existsByExam_Id(exam.getId())) {
			throw new BadRequestException("Cannot delete exam with existing student attempts. Historical records must be preserved.");
		}
		List<Invitation> invitations = invitationRepository.findByExamId(exam.getId());
		boolean hasActiveInvitations = invitations.stream().anyMatch(i ->
				i.getStatus() == InvitationStatus.PENDING
						|| i.getStatus() == InvitationStatus.SENT
						|| i.getStatus() == InvitationStatus.ACCEPTED
		);
		if (hasActiveInvitations) {
			throw new BadRequestException("Cannot delete exam with active invitations. Revoke or remove invitations first.");
		}
		List<ExamReminder> reminders = examReminderRepository.findByExamId(exam.getId());
		if (!reminders.isEmpty()) {
			examReminderRepository.deleteAll(reminders);
		}
		if (!invitations.isEmpty()) {
			invitationRepository.deleteAll(invitations);
		}
	}

	@Override
	protected void beforeCreate(Exam exam, ExamDTO request, ValidationContext context) {
		if (request.getShowAnswersAfterExam() == null) {
			exam.setShowAnswersAfterExam(exam.getCategory().isShowAnswersByDefault());
		}
		if (request.getQuestionIds() != null) {
			ExamType examType = request.getExamType() != null ? request.getExamType() : exam.getExamType();
			exam.setQuestions(resolveQuestions(exam, request.getQuestionIds(), context, examType));
		}
		courseLinkService.apply(exam, request, context);
		courseLinkService.validateWeight(exam, request.isCourseWeightProvided() ? request.getCourseWeight() : exam.getCourseWeight(), context);
		configValidator.validate(null, request, totalPoints(exam.getQuestions()), context);
	}

	@Override
	protected void beforeUpdate(Exam exam, ExamDTO request, ValidationContext context) {
		if (request.getQuestionIds() == null && request.getExamType() != null) {
			validateTypes(request.getExamType(), exam.getQuestions(), context);
		}
		if (request.getQuestionIds() != null) {
			ExamType examType = request.getExamType() != null ? request.getExamType() : exam.getExamType();
			Set<Question> before = new LinkedHashSet<>(exam.getQuestions());
			Set<Question> after = resolveQuestions(exam, request.getQuestionIds(), context, examType);
			if (!context.hasErrors()) {
				exam.setQuestions(after);
				deleteExamCopies(before, after);
			}
		}
		courseLinkService.apply(exam, request, context);
		courseLinkService.validateWeight(exam, request.isCourseWeightProvided() ? request.getCourseWeight() : exam.getCourseWeight(), context);
		configValidator.validate(exam, request, totalPoints(exam.getQuestions()), context);
	}

	@Override
	protected void afterDelete(Exam exam) {
		deleteExamCopies(exam.getQuestions(), Set.of());
	}

	public ExamDTO addQuestions(Long examId, List<Long> questionIds) {
		checkPermission(CrudAction.UPDATE);
		ValidationContext context = new ValidationContext();
		Exam exam = findExam(examId);
		if (examAttemptRepository.existsByExam_Id(exam.getId())) {
			throw new BadRequestException("Đề thi đã có sinh viên làm bài, không thể thêm câu hỏi");
		}
		Set<Question> questions = resolveQuestions(exam, questionIds, context, exam.getExamType());
		context.throwIfErrors();

		exam.getQuestions().addAll(questions);
		return examMapper.toResponse(examRepository.save(exam));
	}

	public ExamDTO removeQuestion(Long examId, Long questionId) {
		checkPermission(CrudAction.UPDATE);
		Exam exam = findExam(examId);
		if (examAttemptRepository.existsByExam_Id(exam.getId())) {
			throw new BadRequestException("Đề thi đã có sinh viên làm bài, không thể xóa câu hỏi");
		}
		Set<Question> before = new LinkedHashSet<>(exam.getQuestions());
		exam.getQuestions().removeIf(question -> question.getId().equals(questionId));
		Exam saved = examRepository.save(exam);
		deleteExamCopies(before, exam.getQuestions());
		return examMapper.toResponse(saved);
	}

	public ExamDTO updateQuestion(Long examId, Long questionId, QuestionDTO request) {
		checkPermission(CrudAction.UPDATE);
		Exam exam = findExam(examId);
		Question copy = exam.getQuestions().stream()
				.filter(q -> q.getId().equals(questionId))
				.findFirst()
				.orElseThrow(() -> new ResourceNotFoundException("Câu hỏi không thuộc đề thi này"));
		if (copy.getSourceQuestionId() == null) {
			throw new BadRequestException("Đây không phải bản sao của đề thi, không thể sửa trong đề");
		}
		if (examAttemptRepository.existsByExam_Id(exam.getId())) {
			throw new BadRequestException("Đề thi đã có sinh viên làm bài, không thể sửa câu hỏi");
		}

		ValidationContext context = new ValidationContext();
		questionValidator.validateForUpdate(copy, request, false, context);
		if (request.getType() != null && !ExamTypePolicy.allows(exam.getExamType(), request.getType())) {
			context.add("type", "Đề thi " + ExamTypePolicy.describe(exam.getExamType()) + ", không thể đổi câu hỏi sang loại này");
		}
		context.throwIfErrors();
		questionMapper.update(copy, request);
		questionRepository.save(copy);

		return examMapper.toResponse(examRepository.save(exam));
	}

	private int totalPoints(Set<Question> questions) {
		return questions == null ? 0 : questions.stream().mapToInt(Question::getPoints).sum();
	}

	private Exam findExam(Long examId) {
		Exam exam = examRepository.findById(examId)
				.orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
		checkOwnership(exam);
		return exam;
	}

	public Exam getExamForPoolConfiguration(Long examId) {
		checkPermission(CrudAction.UPDATE);
		return findExam(examId);
	}

	/**
	 * Lấy các câu hỏi đã thuộc Exam để cấu hình Question Pool.
	 * Không tạo bản sao từ Question Bank.
	 */
	public List<Question> getQuestionsForPoolConfiguration(
			Long examId,
			List<Long> questionIds
	) {
		checkPermission(CrudAction.UPDATE);

		Exam exam = findExam(examId);

		if (questionIds == null || questionIds.isEmpty()) {
			throw new BadRequestException(
					"Question Pool phải có ít nhất một câu hỏi"
			);
		}

		Set<Long> uniqueIds = new LinkedHashSet<>(questionIds);

		if (uniqueIds.contains(null)) {
			throw new BadRequestException(
					"Question ID không được để trống"
			);
		}

		if (uniqueIds.size() != questionIds.size()) {
			throw new BadRequestException(
					"Question Pool không được chứa câu hỏi trùng lặp"
			);
		}

		Map<Long, Question> examQuestions = exam.getQuestions().stream()
				.collect(Collectors.toMap(
						Question::getId,
						question -> question
				));

		List<Question> selectedQuestions = new ArrayList<>();

		for (Long questionId : questionIds) {
			Question question = examQuestions.get(questionId);

			if (question == null) {
				throw new BadRequestException(
						"Câu hỏi " + questionId
								+ " không thuộc đề thi này"
				);
			}

			if (!Boolean.TRUE.equals(question.getIsActive())) {
				throw new BadRequestException(
						"Câu hỏi " + questionId + " đã bị vô hiệu hóa"
				);
			}

			if (!ExamTypePolicy.allows(
					exam.getExamType(),
					question.getType()
			)) {
				throw new BadRequestException(
						"Câu hỏi " + questionId
								+ " không phù hợp với loại đề thi"
				);
			}

			selectedQuestions.add(question);
		}

		return selectedQuestions;
	}

	/** Giao vien (khong phai ADMIN) chi duoc thay/quan ly de thi do chinh minh tao; ADMIN va vai tro khac khong bi gioi han. */
	private Long ownerScopeUserId() {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal
				&& examAccessGuard.isOwnerScoped(principal)) {
			return principal.getUser().getId();
		}
		return null;
	}

	/** De cua nguoi khac duoc coi nhu khong ton tai (khong lo thong tin). */
	private void checkOwnership(Exam exam) {
		Long scope = ownerScopeUserId();
		if (scope != null && !Objects.equals(exam.getCreatedBy(), scope)) {
			throw new ResourceNotFoundException("Exam not found");
		}
	}

	@Override
	public Page<ExamDTO> getAll(Pageable pageable, String search, ExamFilter filter) {
		Long scope = ownerScopeUserId();
		if (scope != null) {
			if (filter == null) {
				filter = new ExamFilter();
			}
			filter.setCreatedBy(scope);
		}
		return super.getAll(pageable, search, filter);
	}

	@Override
	public ExamDTO getById(Long id) {
		examRepository.findById(id).ifPresent(this::checkOwnership);
		return super.getById(id);
	}

	@Override
	public ExamDTO update(Long id, ExamDTO request) {
		examRepository.findById(id).ifPresent(this::checkOwnership);
		return super.update(id, request);
	}

	private void deleteExamCopies(Set<Question> before, Set<Question> after) {
		List<Question> removed = before.stream()
				.filter(q -> q.getSourceQuestionId() != null && !after.contains(q))
				.toList();
		if (!removed.isEmpty()) {
			questionRepository.deleteAll(removed);
		}
	}

	private void validateTypes(ExamType examType, Collection<Question> questions, ValidationContext context) {
		for (Question q : questions) {
			if (!ExamTypePolicy.allows(examType, q.getType())) {
				context.add("examType", "Đề đang có câu hỏi " + q.getId() + " không hợp với kiểu bài thi "
						+ ExamTypePolicy.describe(examType) + ". Hãy gỡ câu đó trước");
				return;
			}
		}
	}

	private Set<Question> resolveQuestions(Exam exam, List<Long> questionIds, ValidationContext context, ExamType examType) {
		Set<Long> uniqueIds = new LinkedHashSet<>();
		if (questionIds == null || questionIds.isEmpty()) {
			context.add("questionIds", "Cần chọn ít nhất một câu hỏi");
			return new LinkedHashSet<>();
		}

		for (Long questionId : questionIds) {
			if (questionId == null) {
				context.add("questionIds", "ID câu hỏi không được để trống");
			} else {
				uniqueIds.add(questionId);
			}
		}

		Map<Long, Question> inExam = new HashMap<>();
		Set<Long> sourcesInExam = new HashSet<>();
		if (exam != null && exam.getQuestions() != null) {
			for (Question q : exam.getQuestions()) {
				inExam.put(q.getId(), q);
				if (q.getSourceQuestionId() != null) {
					sourcesInExam.add(q.getSourceQuestionId());
				}
			}
		}

		Map<Long, Question> found = new HashMap<>();
		for (Question q : questionRepository.findAllById(uniqueIds)) {
			found.put(q.getId(), q);
		}

		List<Question> toClone = new ArrayList<>();
		Set<Long> keptIds = new HashSet<>();

		for (Long id : uniqueIds) {
			if (inExam.containsKey(id)) {
				if (!ExamTypePolicy.allows(examType, inExam.get(id).getType())) {
					context.add("questionIds", "Câu hỏi " + id + " không hợp với kiểu bài thi " + ExamTypePolicy.describe(examType));
				}
				keptIds.add(id);
				continue;
			}
			Question source = found.get(id);
			if (source == null) {
				context.add("questionIds", "Không tìm thấy câu hỏi: " + id);
			} else if (source.getSourceQuestionId() != null) {
				context.add("questionIds", "Câu hỏi " + id + " là bản sao của một đề thi, hãy chọn câu hỏi trong ngân hàng");
			} else if (!Boolean.TRUE.equals(source.getIsActive())) {
				context.add("questionIds", "Không thể thêm câu hỏi đã bị vô hiệu hóa: " + id);
			} else if (!ExamTypePolicy.allows(examType, source.getType())) {
				context.add("questionIds", "Câu hỏi " + id + " không hợp với kiểu bài thi "
						+ ExamTypePolicy.describe(examType) + " (loại câu: " + source.getType() + ")");
			} else if (sourcesInExam.contains(id)) {
				context.add("questionIds", "Câu hỏi " + id + " đã có trong đề");
			} else {
				toClone.add(source);
			}
		}

		Set<Question> result = new LinkedHashSet<>();
		if (context.hasErrors()) {
			return result;
		}

		for (Long id : uniqueIds) {
			if (keptIds.contains(id)) {
				result.add(inExam.get(id));
			}
		}
		for (Question source : toClone) {
			result.add(questionRepository.save(copyOf(source)));
		}
		return result;
	}

	private Question copyOf(Question source) {
		Question copy = new Question();
		copy.setIsActive(Boolean.TRUE);
		copy.setContent(source.getContent());
		copy.setType(source.getType());
		copy.setDifficulty(source.getDifficulty());
		copy.setTopic(source.getTopic());
		copy.setImageUrl(source.getImageUrl());
		copy.setPoints(source.getPoints());
		copy.setCodeSpec(source.getCodeSpec());
		copy.setSourceQuestionId(source.getId());
		source.getGradingCriteria().forEach(sourceCriterion -> {
			EssayGradingCriterion criterion = new EssayGradingCriterion();
			criterion.setName(sourceCriterion.getName());
			criterion.setDescription(sourceCriterion.getDescription());
			criterion.setWeightPercentage(sourceCriterion.getWeightPercentage());
			copy.getGradingCriteria().add(criterion);
		});
		for (QuestionOption o : source.getOptions()) {
			QuestionOption optionCopy = new QuestionOption();
			optionCopy.setContent(o.getContent());
			optionCopy.setCorrect(o.isCorrect());
			optionCopy.setImageUrl(o.getImageUrl());
			optionCopy.setQuestion(copy);
			copy.getOptions().add(optionCopy);
		}
		return copy;
	}
}