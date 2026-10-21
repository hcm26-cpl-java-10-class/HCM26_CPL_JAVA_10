import React, { useState, useMemo } from "react";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { LocationHierarchyCard } from "./components/LocationHierarchyCard";
import { DepartmentTableCard } from "./components/DepartmentTableCard";
import { LocationModal } from "./components/LocationModal";
import { DepartmentModal } from "./components/DepartmentModal";
import { DeleteConfirmDialog } from "./components/DeleteConfirmDialog";
import { ImportExportModal } from "./components/ImportExportModal";
import { initialLocations, initialDepartments } from "./mockData";
import type {
  LocationNode,
  DepartmentItem,
  LocationFormData,
  DepartmentFormData,
} from "./types";

export const LocationDepartmentPage: React.FC = () => {
  // Primary state
  const [locations, setLocations] = useState<LocationNode[]>(initialLocations);
  const [departments, setDepartments] = useState<DepartmentItem[]>(initialDepartments);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // Modals state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationNode | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentItem | null>(null);

  const [isImportExportOpen, setIsImportExportOpen] = useState(false);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "location" | "department";
    location?: LocationNode;
    department?: DepartmentItem;
  }>({
    open: false,
    type: "department",
  });

  // Flattened locations for dropdown selects
  const flatLocations = useMemo(() => {
    const list: { id: string; name: string; code: string; parentId: string | null }[] = [];
    const traverse = (nodes: LocationNode[]) => {
      for (const node of nodes) {
        list.push({
          id: node.id,
          name: node.name,
          code: node.code,
          parentId: node.parentId,
        });
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    traverse(locations);
    return list;
  }, [locations]);

  // Compute department counts directly for each location
  const departmentCountsByLocation = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of departments) {
      counts[d.locationId] = (counts[d.locationId] || 0) + 1;
    }
    return counts;
  }, [departments]);

  // Find all descendant IDs of a location node
  const getDescendantIds = (nodeId: string, tree: LocationNode[]): string[] => {
    const findNode = (nodes: LocationNode[]): LocationNode | null => {
      for (const n of nodes) {
        if (n.id === nodeId) return n;
        if (n.children) {
          const res = findNode(n.children);
          if (res) return res;
        }
      }
      return null;
    };

    const targetNode = findNode(tree);
    if (!targetNode) return [nodeId];

    const result: string[] = [targetNode.id];
    const collectChildren = (node: LocationNode) => {
      if (node.children) {
        for (const c of node.children) {
          result.push(c.id);
          collectChildren(c);
        }
      }
    };
    collectChildren(targetNode);
    return result;
  };

  // Filter departments based on selected location
  const currentDepartments = useMemo(() => {
    if (!selectedLocationId) {
      return departments;
    }
    const matchingLocationIds = new Set(getDescendantIds(selectedLocationId, locations));
    return departments.filter((dept) => matchingLocationIds.has(dept.locationId));
  }, [departments, selectedLocationId, locations]);

  const selectedLocationName = useMemo(() => {
    if (!selectedLocationId) return undefined;
    return flatLocations.find((l) => l.id === selectedLocationId)?.name;
  }, [selectedLocationId, flatLocations]);

  // Location CRUD actions
  const handleAddLocation = (parentId?: string | null) => {
    setEditingLocation(null);
    setDefaultParentId(parentId ?? null);
    setIsLocationModalOpen(true);
  };

  const handleEditLocation = (location: LocationNode) => {
    setEditingLocation(location);
    setDefaultParentId(location.parentId);
    setIsLocationModalOpen(true);
  };

  const handleSaveLocation = (data: LocationFormData) => {
    if (editingLocation) {
      // Recursive update
      const updateNode = (nodes: LocationNode[]): LocationNode[] => {
        return nodes.map((node) => {
          if (node.id === editingLocation.id) {
            return {
              ...node,
              ...data,
            };
          }
          if (node.children) {
            return {
              ...node,
              children: updateNode(node.children),
            };
          }
          return node;
        });
      };

      setLocations((prev) => updateNode(prev));
      // Update any departments referencing the location name
      setDepartments((prev) =>
        prev.map((d) =>
          d.locationId === editingLocation.id ? { ...d, locationName: data.name } : d
        )
      );
      toast.success(`Location "${data.name}" updated successfully!`);
    } else {
      // Add new node
      const newLocation: LocationNode = {
        id: `loc-${Date.now()}`,
        ...data,
        displayOrder: flatLocations.length + 1,
        children: [],
      };

      if (!data.parentId) {
        setLocations((prev) => [...prev, newLocation]);
      } else {
        const insertNode = (nodes: LocationNode[]): LocationNode[] => {
          return nodes.map((node) => {
            if (node.id === data.parentId) {
              return {
                ...node,
                children: [...(node.children || []), newLocation],
              };
            }
            if (node.children) {
              return {
                ...node,
                children: insertNode(node.children),
              };
            }
            return node;
          });
        };
        setLocations((prev) => insertNode(prev));
      }
      toast.success(`Location "${data.name}" created successfully!`);
    }

    setIsLocationModalOpen(false);
    setEditingLocation(null);
  };

  const handleDeleteLocationRequest = (location: LocationNode) => {
    setDeleteDialog({
      open: true,
      type: "location",
      location,
      department: undefined,
    });
  };

  // Department CRUD actions
  const handleAddDepartment = () => {
    setEditingDepartment(null);
    setIsDepartmentModalOpen(true);
  };

  const handleEditDepartment = (dept: DepartmentItem) => {
    setEditingDepartment(dept);
    setIsDepartmentModalOpen(true);
  };

  const handleSaveDepartment = (data: DepartmentFormData) => {
    const loc = flatLocations.find((l) => l.id === data.locationId);
    const locationName = loc ? loc.name : "Unassigned";

    if (editingDepartment) {
      setDepartments((prev) =>
        prev.map((d) =>
          d.id === editingDepartment.id
            ? {
                ...d,
                ...data,
                locationName,
              }
            : d
        )
      );
      toast.success(`Department "${data.code}" updated successfully!`);
    } else {
      const newDept: DepartmentItem = {
        id: `dept-${Date.now()}`,
        ...data,
        locationName,
        linkedEntities: data.linkedEntities || "0 users",
        displayOrder: departments.length + 1,
      };
      setDepartments((prev) => [...prev, newDept]);
      toast.success(`Department "${data.code}" created successfully!`);
    }

    setIsDepartmentModalOpen(false);
    setEditingDepartment(null);
  };

  const handleDeleteDepartmentRequest = (dept: DepartmentItem) => {
    setDeleteDialog({
      open: true,
      type: "department",
      department: dept,
      location: undefined,
    });
  };

  // Confirm delete
  const handleConfirmDelete = () => {
    if (deleteDialog.type === "location" && deleteDialog.location) {
      const locToDelete = deleteDialog.location;
      const removeNode = (nodes: LocationNode[]): LocationNode[] => {
        return nodes
          .filter((n) => n.id !== locToDelete.id)
          .map((n) => ({
            ...n,
            children: n.children ? removeNode(n.children) : [],
          }));
      };

      setLocations((prev) => removeNode(prev));
      if (selectedLocationId === locToDelete.id) {
        setSelectedLocationId(null);
      }
      toast.success(`Location "${locToDelete.name}" deleted successfully!`);
    } else if (deleteDialog.type === "department" && deleteDialog.department) {
      const deptToDelete = deleteDialog.department;
      setDepartments((prev) => prev.filter((d) => d.id !== deptToDelete.id));
      toast.success(`Department "${deptToDelete.code}" deleted successfully!`);
    }

    setDeleteDialog({ open: false, type: "department" });
  };

  const handleImportDepartments = (newDepts: DepartmentItem[]) => {
    setDepartments((prev) => [...newDepts, ...prev]);
  };

  // Pre-calculate delete warning
  const locationDeleteWarning = useMemo(() => {
    if (deleteDialog.type !== "location" || !deleteDialog.location) return undefined;
    const descendantIds = getDescendantIds(deleteDialog.location.id, locations);
    const assignedCount = departments.filter((d) =>
      descendantIds.includes(d.locationId)
    ).length;

    if (assignedCount > 0) {
      return `This location or its sub-locations currently has ${assignedCount} assigned department(s). Deleting it will leave those departments unlinked.`;
    }
    if (deleteDialog.location.children && deleteDialog.location.children.length > 0) {
      return `This location has ${deleteDialog.location.children.length} sub-branches that will also be removed.`;
    }
    return undefined;
  }, [deleteDialog, locations, departments]);

  return (
    <MainLayout
      pathName={{
        fams: "FAMS & LMS",
        system: "System",
        "location-department": "Location & Department",
      }}
    >
      <div className="flex flex-col gap-5 font-sans">
        {/* Page Header Area */}
        <div className="flex flex-col gap-2">
          {/* Breadcrumbs matching SCR-32 specification */}
          <div className="flex items-center text-xs text-gray-500 font-medium">
            <span className="text-gray-500">FAMS &amp; LMS</span>
            <span className="mx-2 text-gray-300">/</span>
            <span className="text-gray-500">System</span>
            <span className="mx-2 text-gray-300">/</span>
            <span className="text-gray-900 font-semibold">
              Location &amp; Department
            </span>
          </div>

          {/* Title and Top Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Location &amp; Department
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage location hierarchy and department data based on assigned permissions.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsImportExportOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4 text-gray-500" />
                <span>Import / Export</span>
              </button>

              <button
                type="button"
                onClick={handleAddDepartment}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>+ Add New</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main 2-Panel Layout: Location Hierarchy (~31% width) & Departments (~69% width) */}
        <div className="flex flex-col lg:flex-row gap-5 items-start w-full">
          {/* Left Panel: Location Hierarchy (Targeting ~31% of available desktop width) */}
          <div className="w-full lg:w-[31%] shrink-0 min-w-0">
            <LocationHierarchyCard
              locations={locations}
              selectedLocationId={selectedLocationId}
              onSelectLocation={setSelectedLocationId}
              onAddLocation={handleAddLocation}
              onEditLocation={handleEditLocation}
              onDeleteLocation={handleDeleteLocationRequest}
              totalDepartmentCount={departments.length}
              departmentCountsByLocation={departmentCountsByLocation}
            />
          </div>

          {/* Right Panel: Departments (~69% of available desktop width) */}
          <div className="w-full lg:w-[69%] flex-1 min-w-0">
            <DepartmentTableCard
              departments={currentDepartments}
              selectedLocationName={selectedLocationName}
              onEditDepartment={handleEditDepartment}
              onDeleteDepartment={handleDeleteDepartmentRequest}
            />
          </div>
        </div>
      </div>

      {/* Modals & Dialogs */}
      <LocationModal
        open={isLocationModalOpen}
        onOpenChange={setIsLocationModalOpen}
        initialData={editingLocation}
        defaultParentId={defaultParentId}
        flatLocations={flatLocations}
        onSubmit={handleSaveLocation}
      />

      <DepartmentModal
        open={isDepartmentModalOpen}
        onOpenChange={setIsDepartmentModalOpen}
        initialData={editingDepartment}
        defaultLocationId={selectedLocationId}
        flatLocations={flatLocations}
        onSubmit={handleSaveDepartment}
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title={
          deleteDialog.type === "location"
            ? "Delete Location"
            : "Delete Department"
        }
        description={
          deleteDialog.type === "location"
            ? "Are you sure you want to delete this location from the hierarchy?"
            : "Are you sure you want to delete this department from the system?"
        }
        itemName={
          deleteDialog.type === "location"
            ? deleteDialog.location?.name
            : `${deleteDialog.department?.code} - ${deleteDialog.department?.name}`
        }
        warningNote={locationDeleteWarning}
        onConfirm={handleConfirmDelete}
      />

      <ImportExportModal
        open={isImportExportOpen}
        onOpenChange={setIsImportExportOpen}
        departments={departments}
        onImportDepartments={handleImportDepartments}
      />
    </MainLayout>
  );
};

export default LocationDepartmentPage;
