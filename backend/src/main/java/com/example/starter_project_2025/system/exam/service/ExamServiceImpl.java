package com.example.starter_project_2025.system.exam.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamFilter;
import com.example.starter_project_2025.system.exam.mapper.ExamMapper;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ExamServiceImpl extends BaseCrudServiceImpl<Exam, Long, ExamDTO, ExamFilter> {

	private final ExamRepository examRepository;
	private final QuestionRepository questionRepository;
	private final ExamMapper examMapper;
	private final ExamConfigValidator configValidator;

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

	// ===== Create: Gắn câu hỏi nếu request có questionIds, rồi kiểm tra cấu hình kỳ thi =====
	@Override
	protected void beforeCreate(Exam exam, ExamDTO request, ValidationContext context) {
		if (request.getQuestionIds() != null) {
			exam.setQuestions(resolveQuestions(request.getQuestionIds(), context));
		}
		configValidator.validate(null, request, totalPoints(exam.getQuestions()), context);
	}

	// ===== Update: Thay danh sách câu hỏi khi request gửi questionIds, rồi kiểm tra cấu hình =====
	// Lưu ý: hook chạy TRƯỚC khi mapper áp request lên entity, nên validator tự gộp request + giá trị hiện có.
	@Override
	protected void beforeUpdate(Exam exam, ExamDTO request, ValidationContext context) {
		if (request.getQuestionIds() != null) {
			exam.setQuestions(resolveQuestions(request.getQuestionIds(), context));
		}
		configValidator.validate(exam, request, totalPoints(exam.getQuestions()), context);
	}

	// ===== POST /api/exams/{id}/questions =====
	public ExamDTO addQuestions(Long examId, List<Long> questionIds) {
		checkPermission(CrudAction.UPDATE);
		ValidationContext context = new ValidationContext();
		Exam exam = findExam(examId);
		Set<Question> questions = resolveQuestions(questionIds, context);
		context.throwIfErrors();

		exam.getQuestions().addAll(questions);
		return examMapper.toResponse(examRepository.save(exam));
	}

	// ===== DELETE /api/exams/{id}/questions/{questionId} =====
	public ExamDTO removeQuestion(Long examId, Long questionId) {
		checkPermission(CrudAction.UPDATE);
		Exam exam = findExam(examId);
		exam.getQuestions().removeIf(question -> question.getId().equals(questionId));
		int remaining = totalPoints(exam.getQuestions());
		if (exam.getPassScore() != null && remaining > 0 && exam.getPassScore() > remaining) {
			ValidationContext context = new ValidationContext();
			context.add("passScore", "Sau khi bỏ câu hỏi, tổng điểm (" + remaining
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

	private Set<Question> resolveQuestions(List<Long> questionIds, ValidationContext context) {
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

		List<Question> foundQuestions = questionRepository.findAllById(uniqueIds);
		Set<Long> foundIds = new LinkedHashSet<>();
		List<Question> activeQuestions = new ArrayList<>();

		for (Question question : foundQuestions) {
			foundIds.add(question.getId());
			if (Boolean.TRUE.equals(question.getIsActive())) {
				activeQuestions.add(question);
			} else {
				context.add("questionIds", "Không thể thêm câu hỏi đã bị vô hiệu hóa: " + question.getId());
			}
		}

		for (Long questionId : uniqueIds) {
			if (!foundIds.contains(questionId)) {
				context.add("questionIds", "Không tìm thấy câu hỏi: " + questionId);
			}
		}

		return new LinkedHashSet<>(activeQuestions);
	}
}