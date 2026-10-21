import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { DepartmentItem, DepartmentFormData } from "../types";

interface DepartmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: DepartmentItem | null;
  defaultLocationId?: string | null;
  flatLocations: { id: string; name: string; code: string }[];
  onSubmit: (data: DepartmentFormData) => void;
}

export const DepartmentModal: React.FC<DepartmentModalProps> = ({
  open,
  onOpenChange,
  initialData,
  defaultLocationId,
  flatLocations,
  onSubmit,
}) => {
  const isEditing = Boolean(initialData);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState("");
  const [linkedEntities, setLinkedEntities] = useState("0 users");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const [errors, setErrors] = useState<{
    code?: string;
    name?: string;
    locationId?: string;
  }>({});

  useEffect(() => {
    if (initialData) {
      setCode(initialData.code);
      setName(initialData.name);
      setLocationId(initialData.locationId);
      setLinkedEntities(initialData.linkedEntities || "0 users");
      setDescription(initialData.description || "");
      setStatus(initialData.status);
    } else {
      setCode("");
      setName("");
      setLocationId(defaultLocationId || (flatLocations[0]?.id ?? ""));
      setLinkedEntities("0 users");
      setDescription("");
      setStatus("Active");
    }
    setErrors({});
  }, [initialData, defaultLocationId, flatLocations, open]);

  const validate = () => {
    const errs: { code?: string; name?: string; locationId?: string } = {};
    if (!code.trim()) {
      errs.code = "Department code is required";
    }
    if (!name.trim()) {
      errs.name = "Department name is required";
    }
    if (!locationId) {
      errs.locationId = "Location selection is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      locationId,
      linkedEntities: linkedEntities.trim() || "0 users",
      description: description.trim(),
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-6 bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            {isEditing ? "Edit Department" : "Add New Department"}
          </DialogTitle>
          <p className="text-xs text-gray-500">
            Assign department units and training domains to site locations.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Department Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Department Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. IT-HN"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors uppercase font-mono"
            />
            {errors.code && (
              <p className="text-xs text-red-500">{errors.code}</p>
            )}
          </div>

          {/* Department Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Information Technology"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Location Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Assigned Location <span className="text-red-500">*</span>
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
            >
              <option value="" disabled>
                Select location...
              </option>
              {flatLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
            {errors.locationId && (
              <p className="text-xs text-red-500">{errors.locationId}</p>
            )}
          </div>

          {/* Linked Entities (Users / Topics count) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Linked Entities
            </label>
            <input
              type="text"
              value={linkedEntities}
              onChange={(e) => setLinkedEntities(e.target.value)}
              placeholder="e.g. 128 users or 12 topics"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational scope, curriculum topics or function"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors resize-none"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Status</label>
            <div className="flex items-center gap-4 pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dept-status"
                  value="Active"
                  checked={status === "Active"}
                  onChange={() => setStatus("Active")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dept-status"
                  value="Inactive"
                  checked={status === "Inactive"}
                  onChange={() => setStatus("Inactive")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Inactive</span>
              </label>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white shadow-xs transition-colors cursor-pointer"
            >
              {isEditing ? "Save Changes" : "Create Department"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
