import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { LocationTree } from "./LocationTree";
import { locationApi } from "@/api/features/rbac/location.api";
import type { LocationNode } from "@/types/features/rbac/location";
import { Users, MapPin, Mail, Phone, Briefcase, RefreshCw, Search, Plus, X, UserPlus, Edit2, Trash2 } from "lucide-react";
import type { EntityConfig } from "@/types";

export const entityConfig: EntityConfig = {
  name: "Location",
  path: "/locations",
  api: locationApi,
  schema: {
    entityName: "location",
    idField: "id",
    fields: [],
  },
};

// Dữ liệu Mock chuẩn Hệ thống Giáo dục / Trường học
const MOCK_LOCATION_DATA: LocationNode[] = [
  {
    id: 1,
    code: "VN",
    name: "Việt Nam (Hệ thống Cơ sở)",
    parentId: null,
    users: [
      { id: 101, username: "GV001", fullName: "GS.TS. Nguyễn Văn A", jobTitle: "Trưởng Ban Đào tạo", email: "nva@edu.vn", phone: "0901234567" },
      { id: 102, username: "NV001", fullName: "ThS. Trần Thị B", jobTitle: "Chuyên viên Khảo thí", email: "ttb@edu.vn", phone: "0909876543" },
    ],
    children: [
      {
        id: 2,
        code: "CAMPUS_HN",
        name: "Cơ sở Hà Nội",
        parentId: 1,
        users: [
          { id: 103, username: "GV002", fullName: "PGS.TS. Lê Văn C", jobTitle: "Giám đốc Cơ sở Hà Nội", email: "lvc@edu.vn", phone: "0912345678" }
        ],
        children: [
          {
            id: 3,
            code: "HOA_LAC",
            name: "Phân hiệu Hòa Lạc",
            parentId: 2,
            users: [
              { id: 104, username: "GV003", fullName: "ThS. Phạm Minh D", jobTitle: "Giảng viên Khoa CNTT", email: "pmd@edu.vn", phone: "0933333333" },
              { id: 105, username: "NV002", fullName: "Hoàng Anh E", jobTitle: "Cán bộ Quản lý Sinh viên", email: "hae@edu.vn", phone: "0944444444" }
            ],
            children: []
          },
          {
            id: 4,
            code: "CAU_GIAY",
            name: "Cơ sở Cầu Giấy (Tòa nhà Đào tạo)",
            parentId: 2,
            users: [
              { id: 106, username: "GV004", fullName: "TS. Đỗ Quốc F", jobTitle: "Trưởng Bộ môn Ngoại ngữ", email: "dqf@edu.vn", phone: "0955555555" }
            ],
            children: []
          }
        ]
      },
      {
        id: 5,
        code: "CAMPUS_HCM",
        name: "Cơ sở TP. Hồ Chí Minh",
        parentId: 1,
        users: [
          { id: 107, username: "GV005", fullName: "TS. Nguyễn Thị G", jobTitle: "Phó Giám đốc Cơ sở HCM", email: "ntg@edu.vn", phone: "0966666666" }
        ],
        children: [
          {
            id: 6,
            code: "KHU_CNCAO",
            name: "Phân hiệu Khu Công nghệ cao (Q9)",
            parentId: 5,
            users: [
              { id: 108, username: "NV003", fullName: "Vũ Văn H", jobTitle: "Giáo vụ Khoa Kỹ thuật", email: "vvh@edu.vn", phone: "0977777777" }
            ],
            children: []
          }
        ]
      },
      {
        id: 7,
        code: "CAMPUS_DN",
        name: "Cơ sở Đà Nẵng",
        parentId: 1,
        users: [],
        children: []
      }
    ]
  }
];

const findNodeById = (nodes: LocationNode[], id: number | string): LocationNode | null => {
  for (const node of nodes) {
    if (node.id === id || String(node.id) === String(id)) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

export const LocationPage: React.FC = () => {
  const [locations, setLocations] = useState<LocationNode[]>(MOCK_LOCATION_DATA);
  const [selectedLocation, setSelectedLocation] = useState<LocationNode | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal Thêm / Sửa Địa điểm
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocationNode, setEditingLocationNode] = useState<LocationNode | null>(null);
  const [locationFormData, setLocationFormData] = useState({ name: "", code: "", parentId: "" });

  // Modal Thêm Nhân sự
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffFormData, setStaffFormData] = useState({
    username: "",
    fullName: "",
    jobTitle: "",
    email: "",
    phone: "",
  });

  // Tải danh sách cây địa điểm từ API (Fallback sang Mock Data nếu DB trống/lỗi)
  const fetchLocationTree = useCallback(async () => {
    try {
      setLoading(true);
      const data = await locationApi.getLocationTree();
      if (data && data.length > 0) {
        setLocations(data);
        setSelectedLocation((prev) => (prev ? findNodeById(data, prev.id) : data[0] ?? null));
      } else {
        setLocations(MOCK_LOCATION_DATA);
        setSelectedLocation((prev) => (prev ? findNodeById(MOCK_LOCATION_DATA, prev.id) : MOCK_LOCATION_DATA[0]));
      }
      toast.success("Đã làm mới dữ liệu sơ đồ địa điểm!");
    } catch (error) {
      console.error("Lỗi khi tải sơ đồ địa điểm:", error);
      setLocations(MOCK_LOCATION_DATA);
      setSelectedLocation((prev) => (prev ? findNodeById(MOCK_LOCATION_DATA, prev.id) : MOCK_LOCATION_DATA[0]));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocationTree();
  }, [fetchLocationTree]);

  // Thao tác Modal Location
  const handleOpenCreateLocationModal = () => {
    setEditingLocationNode(null);
    setLocationFormData({
      name: "",
      code: "",
      parentId: selectedLocation ? String(selectedLocation.id) : "1",
    });
    setIsLocationModalOpen(true);
  };

  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationFormData.name || !locationFormData.code) return;

    if (editingLocationNode) {
      const updateTree = (nodes: LocationNode[]): LocationNode[] => {
        return nodes.map((node) => {
          if (node.id === editingLocationNode.id) {
            return { ...node, name: locationFormData.name, code: locationFormData.code };
          }
          if (node.children) {
            return { ...node, children: updateTree(node.children) };
          }
          return node;
        });
      };
      const updated = updateTree(locations);
      setLocations(updated);
      if (selectedLocation?.id === editingLocationNode.id) {
        setSelectedLocation({ ...selectedLocation, name: locationFormData.name, code: locationFormData.code });
      }
      toast.success("Cập nhật địa điểm thành công!");
    } else {
      const newNode: LocationNode = {
        id: Date.now(),
        name: locationFormData.name,
        code: locationFormData.code,
        parentId: locationFormData.parentId ? Number(locationFormData.parentId) : null,
        users: [],
        children: [],
      };

      const insertTree = (nodes: LocationNode[]): LocationNode[] => {
        return nodes.map((node) => {
          if (String(node.id) === String(locationFormData.parentId)) {
            return { ...node, children: [...(node.children || []), newNode] };
          }
          if (node.children) {
            return { ...node, children: insertTree(node.children) };
          }
          return node;
        });
      };

      if (!locationFormData.parentId) {
        setLocations([...locations, newNode]);
      } else {
        setLocations(insertTree(locations));
      }
      toast.success("Thêm địa điểm mới thành công!");
    }

    setIsLocationModalOpen(false);
  };

  // Thao tác Modal Staff
  const handleOpenAddStaffModal = () => {
    if (!selectedLocation) {
      toast.error("Vui lòng chọn địa điểm trước!");
      return;
    }
    setStaffFormData({ username: "", fullName: "", jobTitle: "", email: "", phone: "" });
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffFormData.username || !staffFormData.fullName || !selectedLocation) return;

    const newStaff = {
      id: Date.now(),
      ...staffFormData,
    };

    const addStaffToTree = (nodes: LocationNode[]): LocationNode[] => {
      return nodes.map((node) => {
        if (node.id === selectedLocation.id) {
          return { ...node, users: [...(node.users || []), newStaff] };
        }
        if (node.children) {
          return { ...node, children: addStaffToTree(node.children) };
        }
        return node;
      });
    };

    const updated = addStaffToTree(locations);
    setLocations(updated);
    setSelectedLocation({
      ...selectedLocation,
      users: [...(selectedLocation.users || []), newStaff],
    });

    toast.success(`Đã thêm nhân sự ${staffFormData.fullName} vào ${selectedLocation.name}!`);
    setIsStaffModalOpen(false);
  };

  // Bộ lọc danh sách nhân sự theo từ khóa tìm kiếm
  const filteredUsers = selectedLocation?.users?.filter((u) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.fullName?.toLowerCase().includes(term) ||
      u.username?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.jobTitle?.toLowerCase().includes(term)
    );
  }) || [];

  return (
    <MainLayout pathName={{ location: "Location" }}>
      <div className="flex flex-col gap-4 w-full text-foreground">
        {/* Toolbar cấp cao: Thanh tìm kiếm + Nút hành động */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border shadow-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm kiếm nhân sự..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background text-sm rounded-md pl-9 pr-4 py-1.5 border border-input focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={fetchLocationTree}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-xs font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreateLocationModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm địa điểm</span>
            </button>
          </div>
        </div>

        {/* Nội dung chính: Sơ đồ cây & Bảng thông tin nhân sự */}
        <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
          {/* Cột trái: Sơ đồ địa điểm */}
          <div className="w-full lg:w-[340px] shrink-0">
            <LocationTree
              selectedLocationId={selectedLocation?.id ?? null}
              onSelectLocation={(node) => setSelectedLocation(node)}
            />
          </div>

          {/* Cột phải: Bảng thông tin nhân sự */}
          <div className="flex-1 w-full min-w-0">
            <div className="rounded-lg border border-border bg-card shadow-xs">
              <div className="p-3.5 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-sm text-card-foreground flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <span>
                      {selectedLocation
                        ? `Danh sách nhân sự — ${selectedLocation.name}`
                        : "Thông tin nhân sự địa điểm"}
                    </span>
                  </h2>
                  {selectedLocation && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Mã địa điểm: <span className="font-mono font-medium">{selectedLocation.code}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedLocation && (
                    <button
                      type="button"
                      onClick={handleOpenAddStaffModal}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer transition-colors"
                    >
                      <UserPlus className="size-3.5" />
                      <span>Thêm nhân sự</span>
                    </button>
                  )}

                  {selectedLocation && (
                    <span className="text-xs bg-primary/10 text-primary font-medium px-2.5 py-0.5 rounded-full border border-primary/20">
                      {selectedLocation.users?.length || 0} nhân sự
                    </span>
                  )}
                </div>
              </div>

              {selectedLocation ? (
                filteredUsers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="uppercase bg-muted/50 text-muted-foreground border-b border-border">
                        <tr>
                          <th className="px-4 py-3 font-medium">Mã NV</th>
                          <th className="px-4 py-3 font-medium">Họ và tên</th>
                          <th className="px-4 py-3 font-medium">Chức danh</th>
                          <th className="px-4 py-3 font-medium">Email</th>
                          <th className="px-4 py-3 font-medium">Số điện thoại</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-card">
                        {filteredUsers.map((user: any) => (
                          <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-mono font-semibold text-foreground">
                              {user.username}
                            </td>
                            <td className="px-4 py-3 font-medium text-foreground">
                              {user.fullName || "---"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-secondary-foreground border border-border">
                                <Briefcase className="size-3" />
                                {user.jobTitle || "N/A"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Mail className="size-3.5" />
                                {user.email || "---"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Phone className="size-3.5" />
                                {user.phone || "---"}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
                    <Users className="size-8 opacity-40" />
                    <span>Địa điểm này hiện chưa có nhân sự nào được gán.</span>
                  </div>
                )
              ) : (
                <div className="py-16 text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-3">
                  <div className="p-3 bg-muted rounded-full">
                    <MapPin className="size-6 opacity-60" />
                  </div>
                  <span>Vui lòng chọn một địa điểm ở sơ đồ bên trái để xem chi tiết nhân sự.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Thêm Địa điểm mới */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                {editingLocationNode ? "Chỉnh sửa Địa điểm" : "Thêm Địa điểm mới"}
              </h3>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="p-4 flex flex-col gap-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Tên địa điểm *
                </label>
                <input
                  type="text"
                  required
                  value={locationFormData.name}
                  onChange={(e) => setLocationFormData({ ...locationFormData, name: e.target.value })}
                  placeholder="e.g. Cơ sở Hà Nội"
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary outline-none text-foreground"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Mã địa điểm *
                </label>
                <input
                  type="text"
                  required
                  value={locationFormData.code}
                  onChange={(e) => setLocationFormData({ ...locationFormData, code: e.target.value })}
                  placeholder="e.g. CAMPUS_HN"
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-primary outline-none text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border hover:bg-accent text-muted-foreground text-xs font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold cursor-pointer"
                >
                  Lưu địa điểm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thêm Nhân sự vào Địa điểm */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <UserPlus className="size-4 text-emerald-500" />
                <span>Thêm Nhân sự vào {selectedLocation?.name}</span>
              </h3>
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-4 flex flex-col gap-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Mã nhân viên / Giảng viên *
                </label>
                <input
                  type="text"
                  required
                  value={staffFormData.username}
                  onChange={(e) => setStaffFormData({ ...staffFormData, username: e.target.value })}
                  placeholder="e.g. GV009"
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-emerald-500 outline-none text-foreground"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  value={staffFormData.fullName}
                  onChange={(e) => setStaffFormData({ ...staffFormData, fullName: e.target.value })}
                  placeholder="e.g. Nguyễn Văn C"
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none text-foreground"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Chức danh
                </label>
                <input
                  type="text"
                  value={staffFormData.jobTitle}
                  onChange={(e) => setStaffFormData({ ...staffFormData, jobTitle: e.target.value })}
                  placeholder="e.g. Giảng viên Khoa CNTT"
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={staffFormData.email}
                    onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
                    placeholder="nvc@edu.vn"
                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={staffFormData.phone}
                    onChange={(e) => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                    placeholder="0912345678"
                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border hover:bg-accent text-muted-foreground text-xs font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Thêm nhân sự
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default LocationPage;