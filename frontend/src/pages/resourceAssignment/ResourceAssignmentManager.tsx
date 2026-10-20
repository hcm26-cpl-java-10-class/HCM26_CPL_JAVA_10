import { useState, useEffect, type FormEvent } from 'react';

interface ResourceAssignment {
    id: number;
    classId: number;
    resourceId: number;
    resourceType: string;
    resourceName?: string;
}

interface ExternalTrainer {
    id: number;
    name: string;
    email: string;
}

interface ExternalClass {
    id: number;
    code: string;
    name: string;
    status?: string;
    startDate?: string;
    capacity?: number;
}

const BACKEND_URL = 'http://localhost:8080';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
};

// Đọc vai trò người dùng từ localStorage để xử lý phân quyền UI
const getUserRole = (): string => {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            return user.role || user.roles?.[0] || 'CLASS_ADMIN';
        }
    } catch {
        // Mặc định vai trò quản trị viên lớp
    }
    return 'CLASS_ADMIN';
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
    const currentRole = getUserRole();
    const isReadOnly = currentRole === 'TRAINEE' || currentRole === 'STUDENT';

    // 1. Quản lý lớp & bộ lọc tra cứu
    const [filterClassId, setFilterClassId] = useState<string>('101');
    const [filterResourceType, setFilterResourceType] = useState<string>('ALL');

    // 2. Dữ liệu
    const [assignments, setAssignments] = useState<ResourceAssignment[]>([]);
    const [classes, setClasses] = useState<ExternalClass[]>([]);
    const [trainers, setTrainers] = useState<ExternalTrainer[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // 3. Form phân công
    const [formData, setFormData] = useState({
        classId: '101',
        resourceType: 'TRAINER',
        resourceId: '',
        resourceName: ''
    });

    // Tải danh mục lớp và giảng viên
    useEffect(() => {
        const fetchSystemResources = async () => {
            const headers = getAuthHeaders();
            try {
                const [classRes, trainerRes] = await Promise.all([
                    fetch(`${BACKEND_URL}/api/external/classes`, { headers }),
                    fetch(`${BACKEND_URL}/api/external/trainers`, { headers })
                ]);

                if (classRes.ok) {
                    const data = await classRes.json();
                    if (Array.isArray(data)) setClasses(data);
                }
                if (trainerRes.ok) {
                    const data = await trainerRes.json();
                    if (Array.isArray(data)) setTrainers(data);
                }
            } catch {
                // Không chặn giao diện nếu API ngoài chưa khởi tạo
            }
        };
        void fetchSystemResources();
    }, []);

    // Tải danh sách phân công
    const fetchAssignments = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (filterClassId.trim() && Number(filterClassId) >= 1) {
                params.append('classId', filterClassId.trim());
            }
            if (filterResourceType !== 'ALL') params.append('resourceType', filterResourceType);
            params.append('size', '100');

            const response = await fetch(`${BACKEND_URL}/api/resource-assignments?${params.toString()}`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error(`Lỗi máy chủ (${response.status})`);
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
        void fetchAssignments();
    }, []);

    // Thống kê phân công của lớp hiện tại
    const currentAssignments = assignments.filter(
        a => !filterClassId.trim() || String(a.classId) === filterClassId.trim()
    );
    const trainerCount = currentAssignments.filter(a => a.resourceType === 'TRAINER').length;
    const adminCount = currentAssignments.filter(a => a.resourceType === 'CLASS_ADMIN').length;
    const courseCount = currentAssignments.filter(a => a.resourceType === 'COURSE').length;

    // Đánh giá quy tắc BR-UNI-08 & Mục 6.1: Có Class Admin, Trainer, Course
    const isReadyForOngoing = adminCount > 0 && trainerCount > 0 && courseCount > 0;

    const handleTrainerSelect = (trainerId: string) => {
        const item = trainers.find(t => String(t.id) === trainerId);
        setFormData(prev => ({
            ...prev,
            resourceId: trainerId,
            resourceName: item ? item.name : ''
        }));
    };

    const handleAssign = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        const targetClassId = Number(formData.classId);
        if (targetClassId < 1 || isNaN(targetClassId)) {
            setError('Mã lớp học phải là số nguyên dương lớn hơn hoặc bằng 1.');
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/resource-assignments`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    classId: targetClassId,
                    resourceId: Number(formData.resourceId),
                    resourceType: formData.resourceType,
                    resourceName: formData.resourceName,
                    isActive: true
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.errors?.resourceId?.[0] || errData?.message || 'Lỗi khi thực hiện phân công');
            }

            setFormData(prev => ({ ...prev, resourceId: '', resourceName: '' }));
            setFilterClassId(formData.classId);
            void fetchAssignments();
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message);
            else setError('Lỗi khi phân công');
        }
    };

    const handleUnassign = async (id: number) => {
        if (!window.confirm('Bạn có chắc chắn muốn hủy phân công mục này?')) return;
        try {
            const response = await fetch(`${BACKEND_URL}/api/resource-assignments/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error('Lỗi khi hủy phân công');
            void fetchAssignments();
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message);
            else setError('Lỗi khi hủy phân công');
        }
    };

    // Tìm thông tin lớp học hiện tại từ danh mục
    const selectedClass = classes.find(c => String(c.id) === filterClassId.trim());

    return (
        <div className="p-6 max-w-6xl mx-auto bg-white rounded-lg shadow space-y-6">
            {/* TIÊU ĐỀ TRANG (Đã bỏ tag SCR-50) */}
            <div className="border-b pb-4 flex flex-wrap justify-between items-center gap-2">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">
                        Chi tiết Lớp học & Phân bổ Tài nguyên
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Quản lý đội ngũ giảng dạy, cán bộ vận hành và chương trình đào tạo theo từng lớp
                    </p>
                </div>
                {isReadOnly && (
                    <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-3 py-1 rounded-full border border-amber-200">
                        Chế độ xem học viên (Read-only)
                    </span>
                )}
            </div>

            {error && <div className="p-3 bg-red-100 text-red-700 rounded border border-red-200">{error}</div>}

            {/* --- KHU VỰC THÔNG TIN TỔNG QUAN LỚP & TIẾN ĐỘ SẴN SÀNG (BR-UNI-08) --- */}
            {filterClassId.trim() && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Thẻ thông tin lớp */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Thông tin lớp học
                        </span>
                        <div className="text-lg font-bold text-gray-800">
                            {selectedClass ? `${selectedClass.code} - ${selectedClass.name}` : `Lớp học #${filterClassId}`}
                        </div>
                        <div className="text-xs text-gray-600 mt-2 space-y-1">
                            <div>Trạng thái: <span className="font-semibold text-blue-700">{selectedClass?.status || 'PLANNING'}</span></div>
                            <div>Quy mô: <span className="font-semibold">{selectedClass?.capacity || 25} học viên</span></div>
                        </div>
                    </div>

                    {/* Thẻ kiểm tra điều kiện chuyển sang ONGOING */}
                    <div className="p-4 md:col-span-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Điều kiện vận hành lớp (BR-UNI-08 & Mục 6.1)
                                </span>
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                                    isReadyForOngoing ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'
                                }`}>
                                    {isReadyForOngoing ? 'Đủ điều kiện ONGOING' : 'Đang chuẩn bị (PLANNING)'}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                                <div className={`p-2 rounded border ${adminCount > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                    Quản nhiệm: <strong>{adminCount > 0 ? `Đã có (${adminCount})` : 'Chưa có'}</strong>
                                </div>
                                <div className={`p-2 rounded border ${trainerCount > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                    Giảng viên: <strong>{trainerCount > 0 ? `Đã có (${trainerCount})` : 'Chưa có'}</strong>
                                </div>
                                <div className={`p-2 rounded border ${courseCount > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                    Chương trình: <strong>{courseCount > 0 ? `Đã có (${courseCount})` : 'Chưa có'}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- THANH TÌM KIẾM & BỘ LỌC LỚP --- */}
            <div className="flex flex-wrap gap-3 items-end p-4 bg-gray-50 rounded border border-gray-200">
                <div className="w-64">
                    <label className="block text-xs font-semibold mb-1 text-gray-600">Chọn lớp học cần xem</label>
                    {classes.length > 0 ? (
                        <select
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                            value={filterClassId}
                            onChange={(e) => {
                                setFilterClassId(e.target.value);
                                setFormData(prev => ({ ...prev, classId: e.target.value }));
                            }}
                        >
                            <option value="">-- Tất cả các lớp --</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="number"
                            min="1"
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                            placeholder="Mã lớp (VD: 101)"
                            value={filterClassId}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || Number(val) >= 1) {
                                    setFilterClassId(val);
                                    setFormData(prev => ({ ...prev, classId: val }));
                                }
                            }}
                        />
                    )}
                </div>

                <div className="w-60">
                    <label className="block text-xs font-semibold mb-1 text-gray-600">Lọc theo hạng mục</label>
                    <select
                        className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                        value={filterResourceType}
                        onChange={(e) => setFilterResourceType(e.target.value)}
                    >
                        <option value="ALL">-- Tất cả hạng mục --</option>
                        <option value="TRAINER">Giảng viên trực tiếp (Trainer)</option>
                        <option value="MASTER_TRAINER">Giảng viên trưởng (Master Trainer)</option>
                        <option value="CLASS_ADMIN">Quản nhiệm lớp (Class Admin)</option>
                        <option value="COURSE">Chương trình đào tạo (Course)</option>
                    </select>
                </div>

                <button
                    type="button"
                    onClick={() => void fetchAssignments()}
                    className="bg-slate-700 hover:bg-slate-800 text-white font-medium text-sm px-4 py-2 rounded transition"
                >
                    Lọc dữ liệu
                </button>
            </div>

            {/* --- FORM PHÂN CÔNG (ẨN ĐỐI VỚI HỌC VIÊN) --- */}
            {!isReadOnly && (
                <form onSubmit={handleAssign} className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700 block">
                        Thêm phân công mới cho lớp #{formData.classId}
                    </span>

                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="w-24">
                            <label className="block text-xs font-semibold mb-1 text-gray-700">Mã lớp</label>
                            <input
                                type="number"
                                min="1"
                                required
                                className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                                value={formData.classId}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || Number(val) >= 1) {
                                        setFormData({ ...formData, classId: val });
                                    }
                                }}
                            />
                        </div>

                        <div className="w-56">
                            <label className="block text-xs font-semibold mb-1 text-gray-700">Hạng mục</label>
                            <select
                                className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                                value={formData.resourceType}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    resourceType: e.target.value,
                                    resourceId: '',
                                    resourceName: ''
                                })}
                            >
                                <option value="TRAINER">Giảng viên trực tiếp (Trainer)</option>
                                <option value="MASTER_TRAINER">Giảng viên trưởng (Master Trainer)</option>
                                <option value="CLASS_ADMIN">Quản nhiệm lớp (Class Admin)</option>
                                <option value="COURSE">Chương trình đào tạo (Course)</option>
                            </select>
                        </div>

                        {['TRAINER', 'MASTER_TRAINER', 'CLASS_ADMIN'].includes(formData.resourceType) && trainers.length > 0 ? (
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-semibold mb-1 text-gray-700">Chọn Nhân sự có sẵn</label>
                                <select
                                    required
                                    className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                                    value={formData.resourceId}
                                    onChange={(e) => handleTrainerSelect(e.target.value)}
                                >
                                    <option value="">-- Chọn nhân sự --</option>
                                    {trainers.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="w-32">
                                <label className="block text-xs font-semibold mb-1 text-gray-700">Mã ID gốc</label>
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                                    value={formData.resourceId}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || Number(val) >= 1) {
                                            setFormData({ ...formData, resourceId: val });
                                        }
                                    }}
                                    placeholder="VD: 10"
                                />
                            </div>
                        )}

                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-semibold mb-1 text-gray-700">Tên / Ghi chú</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                                value={formData.resourceName}
                                onChange={(e) => setFormData({ ...formData, resourceName: e.target.value })}
                                placeholder="Ghi chú thêm..."
                            />
                        </div>

                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-5 py-2 rounded transition"
                        >
                            Phân công vào lớp
                        </button>
                    </div>
                </form>
            )}

            {/* --- BẢNG DANH SÁCH TÀI NGUYÊN (ROSTER) --- */}
            {loading ? (
                <p className="text-gray-500 text-center py-6">Đang tải danh sách phân công...</p>
            ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-gray-100 text-gray-700 text-sm">
                            <th className="p-3 border-b">ID Bản ghi</th>
                            <th className="p-3 border-b">Mã Lớp</th>
                            <th className="p-3 border-b">Hạng mục phân công</th>
                            <th className="p-3 border-b">Mã ID gốc</th>
                            <th className="p-3 border-b">Tên / Ghi chú</th>
                            {!isReadOnly && <th className="p-3 border-b text-right">Thao tác</th>}
                        </tr>
                        </thead>
                        <tbody>
                        {currentAssignments.length === 0 ? (
                            <tr>
                                <td colSpan={isReadOnly ? 5 : 6} className="p-6 text-center text-gray-500">
                                    Lớp #{filterClassId} hiện chưa được gán nhân sự hoặc khóa học nào.
                                </td>
                            </tr>
                        ) : (
                            currentAssignments.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 border-b text-sm">
                                    <td className="p-3 text-gray-500">{item.id}</td>
                                    <td className="p-3 font-semibold text-gray-800">Lớp #{item.classId}</td>
                                    <td className="p-3 font-medium text-gray-900">{formatAssignmentType(item.resourceType)}</td>
                                    <td className="p-3 font-semibold text-blue-600">{item.resourceId}</td>
                                    <td className="p-3 text-gray-700">{item.resourceName || '-'}</td>
                                    {!isReadOnly && (
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => handleUnassign(item.id)}
                                                className="text-red-600 hover:text-red-800 font-medium transition"
                                            >
                                                Hủy phân công
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ResourceAssignmentManager;