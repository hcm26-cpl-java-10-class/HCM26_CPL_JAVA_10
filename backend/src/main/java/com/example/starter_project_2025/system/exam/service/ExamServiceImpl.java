package com.example.starter_project_2025.system.exam.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamFilter;
import com.example.starter_project_2025.system.exam.mapper.ExamMapper;
import com.example.starter_project_2025.system.question.domain.Question;
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
	private final QuestionMapper questionMapper;
	private final QuestionValidator questionValidator;

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

	// ===== Create: Clone các câu hỏi gốc được chọn vào đề, rồi kiểm tra cấu hình kỳ thi =====
	@Override
	protected void beforeCreate(Exam exam, ExamDTO request, ValidationContext context) {
		if (request.getQuestionIds() != null) {
			exam.setQuestions(resolveQuestions(null, request.getQuestionIds(), context));
		}
		configValidator.validate(null, request, totalPoints(exam.getQuestions()), context);
	}

	// ===== Update: Thay danh sách câu hỏi khi request gửi questionIds, rồi kiểm tra cấu hình =====
	// Lưu ý: hook chạy TRƯỚC khi mapper áp request lên entity, nên validator tự gộp request + giá trị hiện có.
	// questionIds có thể gồm id bản sao đang có trong đề (giữ nguyên) và id câu hỏi gốc mới (sẽ được clone).
	@Override
	protected void beforeUpdate(Exam exam, ExamDTO request, ValidationContext context) {
		if (request.getQuestionIds() != null) {
			Set<Question> before = new LinkedHashSet<>(exam.getQuestions());
			Set<Question> after = resolveQuestions(exam, request.getQuestionIds(), context);
			if (!context.hasErrors()) {
				exam.setQuestions(after);
				deleteExamCopies(before, after);
			}
		}
		configValidator.validate(exam, request, totalPoints(exam.getQuestions()), context);
	}

	// Xoá đề thì xoá luôn các bản sao câu hỏi của đề đó (câu hỏi gốc trong ngân hàng không bị đụng tới)
	@Override
	protected void afterDelete(Exam exam) {
		deleteExamCopies(exam.getQuestions(), Set.of());
	}

	// ===== POST /api/exams/{id}/questions =====
	public ExamDTO addQuestions(Long examId, List<Long> questionIds) {
		checkPermission(CrudAction.UPDATE);
		ValidationContext context = new ValidationContext();
		Exam exam = findExam(examId);
		Set<Question> questions = resolveQuestions(exam, questionIds, context);
		context.throwIfErrors();

		exam.getQuestions().addAll(questions);
		return examMapper.toResponse(examRepository.save(exam));
	}

	// ===== DELETE /api/exams/{id}/questions/{questionId} =====
	// Chỉ gỡ câu hỏi khỏi đề (xoá bản sao); câu hỏi gốc trong ngân hàng giữ nguyên
	public ExamDTO removeQuestion(Long examId, Long questionId) {
		checkPermission(CrudAction.UPDATE);
		Exam exam = findExam(examId);
		Set<Question> before = new LinkedHashSet<>(exam.getQuestions());
		exam.getQuestions().removeIf(question -> question.getId().equals(questionId));
		int remaining = totalPoints(exam.getQuestions());
		if (exam.getPassScore() != null && remaining > 0 && exam.getPassScore() > remaining) {
			ValidationContext context = new ValidationContext();
			context.add("passScore", "Sau khi bỏ câu hỏi, tổng điểm (" + remaining
					+ ") nhỏ hơn điểm đạt (" + exam.getPassScore() + "). Hãy hạ điểm đạt trước");
			context.throwIfErrors();
		}
		Exam saved = examRepository.save(exam);
		deleteExamCopies(before, exam.getQuestions());
		return examMapper.toResponse(saved);
	}

	// ===== PUT /api/exams/{id}/questions/{questionId} =====
	// Sửa bản sao câu hỏi trong đề; không ảnh hưởng câu hỏi gốc. Chỉ được sửa khi đề chưa đến giờ bắt đầu.
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
		if (exam.getStartTime() != null && !LocalDateTime.now().isBefore(exam.getStartTime())) {
			throw new BadRequestException("Đề thi đã bắt đầu, không thể sửa câu hỏi");
		}

		ValidationContext context = new ValidationContext();
		questionValidator.validateForUpdate(copy, request, false, context);
		context.throwIfErrors();
		questionMapper.update(copy, request);
		questionRepository.save(copy);

		int total = totalPoints(exam.getQuestions());
		if (exam.getPassScore() != null && total > 0 && exam.getPassScore() > total) {
			context.add("points", "Sau khi đổi điểm, tổng điểm (" + total
					+ ") nhỏ hơn điểm đạt (" + exam.getPassScore() + "). Hãy hạ điểm đạt trước");
			context.throwIfErrors();
		}
		return examMapper.toResponse(examRepository.save(exam));
	}

	private int totalPoints(Set<Question> questions) {
		return questions == null ? 0 : questions.stream().mapToInt(Question::getPoints).sum();
	}

	private Exam findExam(Long examId) {
		return examRepository.findById(examId)
				.orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
	}

	// Xoá những bản sao có trong `before` nhưng không còn trong `after`
	private void deleteExamCopies(Set<Question> before, Set<Question> after) {
		List<Question> removed = before.stream()
				.filter(q -> q.getSourceQuestionId() != null && !after.contains(q))
				.toList();
		if (!removed.isEmpty()) {
			questionRepository.deleteAll(removed);
		}
	}

	// Id đã có trong đề -> giữ nguyên. Id câu hỏi gốc -> tạo bản sao riêng cho đề.
	private Set<Question> resolveQuestions(Exam exam, List<Long> questionIds, ValidationContext context) {
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
		if (exam != null) {
			for (Question q : exam.getQuestions()) {
				inExam.put(q.getId(), q);
				if (q.getSourceQuestionId() != null) sourcesInExam.add(q.getSourceQuestionId());
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
			if (keptIds.contains(id)) result.add(inExam.get(id));
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
		copy.setPoints(source.getPoints());
		copy.setSourceQuestionId(source.getId());
		for (QuestionOption o : source.getOptions()) {
			QuestionOption optionCopy = new QuestionOption();
			optionCopy.setContent(o.getContent());
			optionCopy.setCorrect(o.isCorrect());
			optionCopy.setQuestion(copy);
			copy.getOptions().add(optionCopy);
		}
		return copy;
	}
}