import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
    getTrainingClass,
    type TrainingClassResponse,
} from "@/api/features/schedule/training-class.api";

export default function TrainingClassDetailPage() {
    const { classId } = useParams<{ classId: string }>();

    const [data, setData] = useState<TrainingClassResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let active = true;

        setData(null);
        setError("");
        setLoading(true);

        if (!classId || !/^[1-9]\d*$/.test(classId)) {
            setError("ID lớp không hợp lệ.");
            setLoading(false);
            return;
        }

        getTrainingClass(classId)
            .then((result) => {
                if (active) setData(result);
            })
            .catch((err: unknown) => {
                if (!active) return;

                let message = "Chưa tải được thông tin lớp. Bạn thử lại nhé.";

                if (axios.isAxiosError(err)) {
                    switch (err.response?.status) {
                        case 401:
                            message = "Bạn cần đăng nhập để xem lớp.";
                            break;
                        case 403:
                            message = "Bạn không có quyền xem lớp này.";
                            break;
                        case 404:
                            message = "Không tìm thấy lớp học.";
                            break;
                    }
                }

                setError(message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [classId, reload]);

    const fields: [string, string | number][] = data
        ? [
            ["Mã lớp", data.code],
            ["Tên lớp", data.name],
            ["Loại học viên", data.traineeType],
            ["Hình thức đào tạo", data.deliveryFormat],
            ["Cơ sở", data.site],
            ["Địa điểm", data.location],
            ["ID phiên bản chương trình", data.programVersionId],
            ["Ngày bắt đầu", data.startDate],
            ["Ngày kết thúc", data.endDate],
            ["Sức chứa", data.capacity],
            ["Trạng thái", data.status],
        ]
        : [];

    return (
        <main className="min-h-screen bg-slate-50 p-6">
            <section className="mx-auto max-w-4xl rounded-xl border bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-semibold">Chi tiết lớp học</h1>

                {loading && (
                    <p className="mt-6" role="status">
                        Đang tải thông tin lớp...
                    </p>
                )}

                {error && (
                    <div className="mt-6" role="alert">
                        <p className="text-red-600">{error}</p>

                        <button
                            type="button"
                            className="mt-3 rounded border px-4 py-2"
                            onClick={() => setReload((value) => value + 1)}
                        >
                            Thử lại
                        </button>
                    </div>
                )}

                {!loading && data && (
                    <>
                        <p className="mt-2 text-sm text-slate-500">
                            ID lớp: {data.id}
                        </p>

                        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                            {fields.map(([label, value]) => (
                                <div key={label} className="rounded-lg border p-4">
                                    <dt className="text-sm text-slate-500">{label}</dt>
                                    <dd className="mt-1 break-words font-medium">
                                        {value}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </>
                )}
            </section>
        </main>
    );
}