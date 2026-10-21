import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Building2,
  Layers,
} from "lucide-react";
import type { LocationNode } from "../types";

interface LocationHierarchyCardProps {
  locations: LocationNode[];
  selectedLocationId: string | null;
  onSelectLocation: (locationId: string | null) => void;
  onAddLocation: (parentId?: string | null) => void;
  onEditLocation: (location: LocationNode) => void;
  onDeleteLocation: (location: LocationNode) => void;
  totalDepartmentCount: number;
  departmentCountsByLocation: Record<string, number>;
}

export const LocationHierarchyCard: React.FC<LocationHierarchyCardProps> = ({
  locations,
  selectedLocationId,
  onSelectLocation,
  onAddLocation,
  onEditLocation,
  onDeleteLocation,
  totalDepartmentCount,
  departmentCountsByLocation,
}) => {
  // Track expanded node IDs (default: root and primary nodes expanded)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    "loc-vn": true,
    "loc-hn": true,
    "loc-dn": true,
    "loc-hcm": true,
    "loc-ct": true,
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Helper to calculate total count for node and its descendants
  const getNodeTotalCount = (node: LocationNode): number => {
    let count = departmentCountsByLocation[node.id] || 0;
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        count += getNodeTotalCount(child);
      }
    }
    return count;
  };

  const renderLocationNode = (node: LocationNode, depth: number = 0) => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = expandedIds[node.id] ?? false;
    const isSelected = selectedLocationId === node.id;
    const count = getNodeTotalCount(node);

    // Streamlined indentation: 8px base + 14px per depth level
    const indentPadding = depth * 14 + 8;

    return (
      <div key={node.id} className="flex flex-col">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectLocation(node.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              onSelectLocation(node.id);
            }
          }}
          className={`group relative flex items-center justify-between py-2 px-2.5 rounded-lg text-sm transition-all cursor-pointer ${
            isSelected
              ? "bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600 shadow-xs"
              : "text-gray-700 hover:bg-gray-100/70 border-l-4 border-transparent"
          }`}
          style={{ paddingLeft: `${indentPadding}px` }}
        >
          {/* Node Icon & Label Container */}
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-0.5 rounded text-gray-400 hover:text-gray-700 transition-colors cursor-pointer shrink-0"
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>
            ) : (
              <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              </span>
            )}

            {depth === 0 ? (
              <Layers className="h-4 w-4 shrink-0 text-blue-600" />
            ) : depth === 1 ? (
              <Building2 className="h-4 w-4 shrink-0 text-blue-500" />
            ) : (
              <MapPin className="h-4 w-4 shrink-0 text-blue-400" />
            )}

            <span className="truncate text-sm" title={node.name}>
              {node.name}
            </span>
          </div>

          {/* Right Action Icons & Count Badge - Aligned near right edge */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto pl-2">
            {/* Quick action buttons on hover (positioned to the left of the badge so badge never shifts) */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                type="button"
                title="Edit location"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditLocation(node);
                }}
                className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-white shadow-xs cursor-pointer transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Delete location"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteLocation(node);
                }}
                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-white shadow-xs cursor-pointer transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Count Badge */}
            <span
              className={`text-xs min-w-[24px] px-2 py-0.5 rounded-full font-medium text-center transition-colors ${
                isSelected
                  ? "bg-blue-200/80 text-blue-800"
                  : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
              }`}
            >
              {count}
            </span>
          </div>
        </div>

        {/* Children indented */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col space-y-0.5 mt-0.5">
            {node.children!.map((child) => renderLocationNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col gap-3 min-w-0 w-full">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div>
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">
            Location Hierarchy
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Filter departments by site</p>
        </div>

        <button
          type="button"
          onClick={() => onAddLocation(selectedLocationId)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors cursor-pointer"
          title="Add new location"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Tree Content */}
      <div className="flex flex-col space-y-1">
        {/* All Locations Option */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectLocation(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              onSelectLocation(null);
            }
          }}
          className={`flex items-center justify-between py-2 px-2.5 rounded-lg text-sm transition-all cursor-pointer ${
            selectedLocationId === null
              ? "bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600 shadow-xs"
              : "text-gray-700 hover:bg-gray-100/70 border-l-4 border-transparent"
          }`}
          style={{ paddingLeft: "8px" }}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Layers className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="truncate">All Locations</span>
          </div>
          <span
            className={`text-xs min-w-[24px] px-2 py-0.5 rounded-full font-medium text-center ml-auto shrink-0 ${
              selectedLocationId === null
                ? "bg-blue-200/80 text-blue-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {totalDepartmentCount}
          </span>
        </div>

        {/* Separator */}
        <div className="my-1 border-t border-gray-100" />

        {/* Hierarchical Nodes */}
        <div className="flex flex-col space-y-0.5 max-h-[580px] overflow-y-auto pr-1">
          {locations.map((loc) => renderLocationNode(loc, 0))}
        </div>
      </div>
    </div>
  );
};
