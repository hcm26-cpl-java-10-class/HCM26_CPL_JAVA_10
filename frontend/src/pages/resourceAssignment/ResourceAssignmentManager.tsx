import { useState, useEffect, type FormEvent } from 'react';

interface ResourceAssignment {
    id: number;
    resourceId: number;
    resourceType: string;
    resourceName: string;
}

interface ExternalClass {
    id: number;
    code: string;
    name: string;
}

const BACKEND_URL = 'http://localhost:8080';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
};

const formatAssignmentType = (type: string) => {
    switch (type) {
        case 'TRAINER':
            return 'Giảng viên trực tiếp (Trainer)';
        case 'MASTER_TRAINER':
            return 'Giảng viên trưởng (Master Trainer)';
        case 'CLASS_ADMIN':
            return 'Quản nhiệm lớp (Class Admin)';
        case 'COURSE':
            return 'Chương trình đào tạo (Course)';
        default:
            return type;
    }
};

const ResourceAssignmentManager = () => {
    // Quản lý ID lớp đang được chọn (mặc định bắt đầu từ 101)
    const [selectedClassId, setSelectedClassId] = useState<number>(101);
    const [inputClassId, setInputClassId] = useState<string>('101');
    const [classList, setClassList] = useState<ExternalClass[]>([]);

    const [assignments, setAssignments] = useState<ResourceAssignment[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        resourceId: '',
        resourceType: 'TRAINER',
        resourceName: ''
    });

    // 1. Tải danh sách lớp học từ API hệ thống (nếu có sẵn)
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/external/classes`, {
                    headers: getAuthHeaders()
                });
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setClassList(data);
                    }
                }
            } catch {
                // Bỏ qua nếu API ngoài chưa có dữ liệu, dùng ô nhập tay
            }
        };
        fetchClasses();
    }, []);

    // 2. Tải danh sách phân công của lớp đang chọn
    const fetchAssignments = async (classId: number) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${BACKEND_URL}/api/resource-assignments?classId=${classId}&size=100`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Lỗi máy chủ (${response.status}): Không thể tải dữ liệu`);
            }

            const data = await response.json();
            setAssignments(data.content || []);
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message);
            else setError('Đã xảy ra lỗi không xác định');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedClassId) {
            fetchAssignments(selectedClassId);
        }
    }, [selectedClassId]);

    // Xử lý chuyển đổi lớp học thủ công
    const handleClassChange = (newClassId: number) => {
        setSelectedClassId(newClassId);
        setInputClassId(newClassId.toString());
    };

    // 3. Phân công vào đúng lớp đang chọn
    const handleAssign = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        try {
            const response = await fetch(`${BACKEND_URL}/api/resource-assignments`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    ...formData,
                    resourceId: Number(formData.resourceId),
                    classId: selectedClassId,
                    isActive: true
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.errors?.resourceId?.[0] || errData?.message || 'Lỗi khi thực hiện phân công');
            }

            setFormData({ resourceId: '', resourceType: 'TRAINER', resourceName: '' });
            fetchAssignments(selectedClassId);
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message);
            else setError('Lỗi khi thực hiện phân công');
        }
    };

    // 4. Bỏ phân công
    const handleUnassign = async (id: number) => {
        if (!window.confirm('Bạn có chắc chắn muốn hủy phân công mục này?')) return;
        try {
            const response = await fetch(`${BACKEND_URL}/api/resource-assignments/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error('Lỗi khi hủy phân công');
            fetchAssignments(selectedClassId);
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message);
            else setError('Lỗi khi hủy phân công');
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto bg-white rounded-lg shadow-md space-y-6">
            {/* KHU VỰC CHỌN LỚP HỌC */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap items-center justify-between gap-4">
                <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block">Đang làm việc với</span>
                    <h2 className="text-xl font-bold text-gray-800">
                        Lớp học: <span className="text-blue-700">#{selectedClassId}</span>
                    </h2>
                </div>

                <div className="flex items-center gap-3">
                    {/* Danh sách lớp lấy từ hệ thống */}
                    {classList.length > 0 && (
                        <select
                            className="p-2 border border-gray-300 rounded bg-white text-sm"
                            value={selectedClassId}
                            onChange={(e) => handleClassChange(Number(e.target.value))}
                        >
                            <option value="" disabled>-- Chọn lớp học --</option>
                            {classList.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.code} - {c.name} (ID: {c.id})
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Ô nhập ID lớp trực tiếp */}
                    <div className="flex items-center gap-1">
                        <label className="text-sm text-gray-600 font-medium">Nhập ID lớp:</label>
                        <input
                            type="number"
                            className="w-24 p-2 border border-gray-300 rounded text-sm bg-white"
                            value={inputClassId}
                            onChange={(e) => setInputClassId(e.target.value)}
                            placeholder="VD: 102"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const val = Number(inputClassId);
                                if (val > 0) handleClassChange(val);
                            }}
                            className="bg-blue-600 text-white text-sm px-3 py-2 rounded hover:bg-blue-700 transition"
                        >
                            Xem lớp
                        </button>
                    </div>
                </div>
            </div>

            {error && <div className="p-3 bg-red-100 text-red-700 rounded border border-red-200">{error}</div>}

            {/* FORM PHÂN CÔNG CHO LỚP ĐANG CHỌN */}
            <form onSubmit={handleAssign} className="flex gap-4 items-end p-4 bg-gray-50 rounded border border-gray-200">
                <div className="flex-[1.5]">
                    <label className="block text-sm font-semibold mb-1 text-gray-700">Hạng mục phân công</label>
                    <select
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
                        value={formData.resourceType}
                        onChange={(e) => setFormData({ ...formData, resourceType: e.target.value })}
                    >
                        <option value="TRAINER">Giảng viên trực tiếp (Trainer)</option>
                        <option value="MASTER_TRAINER">Giảng viên trưởng (Master Trainer)</option>
                        <option value="CLASS_ADMIN">Quản nhiệm lớp (Class Admin)</option>
                        <option value="COURSE">Chương trình đào tạo (Course)</option>
                    </select>
                </div>

                <div className="flex-1">
                    <label className="block text-sm font-semibold mb-1 text-gray-700">Mã ID nhân sự / môn</label>
                    <input
                        type="number"
                        required
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        value={formData.resourceId}
                        onChange={(e) => setFormData({ ...formData, resourceId: e.target.value })}
                        placeholder="VD: 1, 2, 55..."
                    />
                </div>

                <div className="flex-1">
                    <label className="block text-sm font-semibold mb-1 text-gray-700">Tên / Ghi chú (Tùy chọn)</label>
                    <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        value={formData.resourceName}
                        onChange={(e) => setFormData({ ...formData, resourceName: e.target.value })}
                        placeholder="VD: Thầy Bình"
                    />
                </div>

                <button type="submit" className="bg-blue-600 text-white font-medium px-6 py-2 rounded hover:bg-blue-700 transition">
                    Gán vào lớp #{selectedClassId}
                </button>
            </form>

            {/* BẢNG DANH SÁCH CỦA LỚP ĐANG CHỌN */}
            {loading ? (
                <p className="text-gray-500 text-center py-4">Đang tải danh sách phân công của lớp #{selectedClassId}...</p>
            ) : (
                <table className="w-full text-left border-collapse border border-gray-200">
                    <thead>
                    <tr className="bg-gray-100 text-gray-700">
                        <th className="p-3 border-b">Mã hệ thống</th>
                        <th className="p-3 border-b">Hạng mục</th>
                        <th className="p-3 border-b">Mã ID gốc</th>
                        <th className="p-3 border-b">Tên / Ghi chú</th>
                        <th className="p-3 border-b text-right">Thao tác</th>
                    </tr>
                    </thead>
                    <tbody>
                    {assignments.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="p-4 text-center text-gray-500">
                                Lớp #{selectedClassId} chưa có giáo viên hoặc chương trình nào được gán.
                            </td>
                        </tr>
                    ) : (
                        assignments.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 border-b">
                                <td className="p-3 text-gray-600">{item.id}</td>
                                <td className="p-3 font-medium text-gray-900">{formatAssignmentType(item.resourceType)}</td>
                                <td className="p-3 font-semibold text-blue-600">{item.resourceId}</td>
                                <td className="p-3 text-gray-700">{item.resourceName || '-'}</td>
                                <td className="p-3 text-right">
                                    <button
                                        onClick={() => handleUnassign(item.id)}
                                        className="text-red-600 hover:text-red-800 font-medium transition"
                                    >
                                        Hủy phân công
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default ResourceAssignmentManager;