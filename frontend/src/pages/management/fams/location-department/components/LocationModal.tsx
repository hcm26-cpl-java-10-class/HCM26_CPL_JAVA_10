import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { LocationNode, LocationFormData } from "../types";

interface LocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: LocationNode | null;
  defaultParentId?: string | null;
  flatLocations: { id: string; name: string; code: string }[];
  onSubmit: (data: LocationFormData) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  open,
  onOpenChange,
  initialData,
  defaultParentId,
  flatLocations,
  onSubmit,
}) => {
  const isEditing = Boolean(initialData);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});

  useEffect(() => {
    if (initialData) {
      setCode(initialData.code);
      setName(initialData.name);
      setParentId(initialData.parentId);
      setAddress(initialData.address || "");
      setDescription(initialData.description || "");
      setStatus(initialData.status);
    } else {
      setCode("");
      setName("");
      setParentId(defaultParentId ?? null);
      setAddress("");
      setDescription("");
      setStatus("Active");
    }
    setErrors({});
  }, [initialData, defaultParentId, open]);

  const validate = () => {
    const errs: { code?: string; name?: string } = {};
    if (!code.trim()) {
      errs.code = "Location code is required";
    }
    if (!name.trim()) {
      errs.name = "Location name is required";
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
      parentId: parentId || null,
      address: address.trim(),
      description: description.trim(),
      status,
    });
  };

  // Exclude current editing location and its descendants from parent options
  const eligibleParents = flatLocations.filter(
    (loc) => !initialData || loc.id !== initialData.id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-6 bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            {isEditing ? "Edit Location" : "Add Location"}
          </DialogTitle>
          <p className="text-xs text-gray-500">
            Define a geographic node in the organizational structure.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Location Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Location Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. LOC-HN-HL"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors uppercase font-mono"
            />
            {errors.code && (
              <p className="text-xs text-red-500">{errors.code}</p>
            )}
          </div>

          {/* Location Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Location Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hòa Lạc Campus"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Parent Location */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Parent Location
            </label>
            <select
              value={parentId || ""}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
            >
              <option value="">None / Root Level</option>
              {eligibleParents.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Address / Region
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Km 29 Thang Long Boulevard, Thach That, Ha Noi"
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
              placeholder="Brief details about facilities or branch scope"
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
                  name="status"
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
                  name="status"
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
              {isEditing ? "Save Changes" : "Create Location"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
