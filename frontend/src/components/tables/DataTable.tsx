// components/tables/DataTable.tsx
import React from "react";
import Pagination from "@/components/Pagination";

interface Column<T> {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
  };
  selection?: {
    selectedItems: T[keyof T][];
    onSelectionChange: (items: T[keyof T][]) => void;
    isAllSelected?: boolean;
    onSelectAll?: () => void;
  };
  className?: string;
}

export default function DataTable<T extends { [key: string]: unknown }>({
  data,
  columns,
  keyField,
  loading = false,
  emptyMessage = "데이터가 없습니다.",
  pagination,
  selection,
  className = "",
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="text-gray-50">로딩 중...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <div className="text-gray-50">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className={`table-wrapper w-fit max-w-full mb-[0.5rem] ${className}`}
      >
        <table className="w-full small">
          <thead>
            <tr>
              {selection && (
                <th className="w-8">
                  <input
                    type="checkbox"
                    checked={selection.isAllSelected || false}
                    onChange={selection.onSelectAll}
                    className="w-[0.75rem] h-[0.75rem]"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th key={String(column.key)} className={column.className || ""}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={String(item[keyField])}
                className={
                  selection?.selectedItems.includes(item[keyField])
                    ? "bg-blue-50"
                    : ""
                }
              >
                {selection && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selection.selectedItems.includes(item[keyField])}
                      onChange={() => {
                        const isSelected = selection.selectedItems.includes(
                          item[keyField],
                        );
                        const newSelection = isSelected
                          ? selection.selectedItems.filter(
                              (id) => id !== item[keyField],
                            )
                          : [...selection.selectedItems, item[keyField]];
                        selection.onSelectionChange(newSelection);
                      }}
                      className="w-[0.75rem] h-[0.75rem]"
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={column.className || ""}
                  >
                    {column.render
                      ? column.render(item[column.key], item)
                      : String(item[column.key] || "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.onPageChange}
          itemsPerPage={pagination.itemsPerPage}
          totalItems={pagination.totalItems}
        />
      )}
    </div>
  );
}
