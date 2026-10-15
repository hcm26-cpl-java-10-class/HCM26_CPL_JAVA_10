import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getMyExamAttempts,
    getStudentExams,
    type Exam,
    type ExamAttemptSummary,
} from '../../api/exam.api';

export default function StudentExamList() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [attempts, setAttempts] = useState<ExamAttemptSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        Promise.all([getStudentExams(), getMyExamAttempts()])
            .then(([examPage, studentAttempts]) => {
                setExams(examPage.content || []);
                setAttempts(studentAttempts);
            })
            .catch((err) => {
                console.error('Lỗi khi tải lịch thi:', err);
                setLoadError('Không thể tải lịch thi. Vui lòng thử lại.');
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="p-6 text-gray-300">Đang tải lịch thi...</div>;
    }

    return (
        <div className="p-6 text-white max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-100">Lịch Thi Của Tôi</h1>
                <p className="text-slate-400 text-sm mt-1">
                    Danh sách các kỳ thi khả dụng dành cho sinh viên.
                </p>
            </div>

            {loadError && (
                <div role="alert" className="mb-5 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
                    {loadError}
                </div>
            )}

            {exams.length === 0 ? (
                <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl text-center text-gray-400">
                    Hiện chưa có kỳ thi nào được xếp lịch.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {exams.map((exam) => {
                        const attempt = attempts.find((item) => item.examId === exam.id);
                        const buttonLabel = attempt?.status === 'IN_PROGRESS'
                            ? 'Tiếp tục làm bài'
                            : attempt
                                ? 'Xem kết quả'
                                : 'Vào thi';

                        return (
                            <div
                                key={exam.id}
                                className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between"
                            >
                                <div>
                <span className="inline-block px-2.5 py-1 bg-cyan-950 text-cyan-400 text-xs font-semibold rounded-full mb-3">
                  {exam.durationMinutes} Phút
                </span>
                                    <h3 className="text-lg font-semibold text-slate-100 mb-2">
                                        {exam.title}
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        Tổng điểm: <span className="text-slate-200">{exam.totalPoints ?? 'Chưa cập nhật'}</span>
                                    </p>
                                    {attempt?.status === 'IN_PROGRESS' && (
                                        <p className="mt-2 text-sm text-amber-300">Bài thi đang làm</p>
                                    )}
                                    {attempt?.status === 'PENDING_REVIEW' && (
                                        <p className="mt-2 text-sm text-amber-300">
                                            Điểm trắc nghiệm tạm thời: {attempt.objectiveScore ?? 0}/{attempt.totalPoints}; chờ chấm tự luận
                                        </p>
                                    )}
                                    {attempt?.status === 'SUBMITTED' && (
                                        <p className="mt-2 text-sm text-emerald-300">
                                            Điểm: {attempt.finalScore ?? 0}/{attempt.totalPoints}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                                    <button
                                        onClick={() => navigate(`/student/exams/${exam.id}/take`)}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm py-2 px-4 rounded-lg transition"
                                    >
                                        {buttonLabel}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}