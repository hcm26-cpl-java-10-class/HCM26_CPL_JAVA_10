import { useEffect, useState } from 'react';
import { getStudentExams, type Exam } from '../../api/exam.api';

export default function StudentExamList() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        getStudentExams()
            .then((data) => setExams(data.content || []))
            .catch((err) => console.error('Lỗi khi tải danh sách bài thi:', err))
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

            {exams.length === 0 ? (
                <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl text-center text-gray-400">
                    Hiện chưa có kỳ thi nào được xếp lịch.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {exams.map((exam) => (
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
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                                <button
                                    onClick={() => alert(`Bắt đầu làm bài thi ID: ${exam.id}`)}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm py-2 px-4 rounded-lg transition"
                                >
                                    Vào Thi
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}