// lib/hooks/useConfirm.ts
import { useState, useCallback } from "react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
}

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(
    null,
  );

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(options);
      setResolver(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolver?.(true);
    setIsOpen(false);
    setOptions(null);
    setResolver(null);
  }, [resolver]);

  const handleCancel = useCallback(() => {
    resolver?.(false);
    setIsOpen(false);
    setOptions(null);
    setResolver(null);
  }, [resolver]);

  const ConfirmDialog = useCallback(() => {
    if (!isOpen || !options) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-[1rem] shadow-xl max-w-md w-full">
          <div className="p-[1rem] space-y-[0.25rem]">
            {options.title && (
              <h3 className="text-lg font-semibold text-dark-gray">
                {options.title}
              </h3>
            )}
            <p className="text-gray-600 mb-6">{options.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={handleCancel} className="button gray">
                {options.cancelText || "취소"}
              </button>
              <button
                onClick={handleConfirm}
                className={`button ${
                  options.type === "danger"
                    ? "red"
                    : options.type === "warning"
                      ? "yellow"
                      : "purple"
                }`}
              >
                {options.confirmText || "확인"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }, [isOpen, options, handleConfirm, handleCancel]);

  return {
    confirm,
    ConfirmDialog,
  };
}
