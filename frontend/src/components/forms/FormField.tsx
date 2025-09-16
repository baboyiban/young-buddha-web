// components/forms/FormField.tsx
import React from "react";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-[0.25rem] ${className}`}>
      <label className="text-sm font-medium text-dark-gray" htmlFor={htmlFor}>
        {label}
        {required && <span className="text-dark-red ml-1">*</span>}
      </label>
      {children}
      {error && <span className="text-sm text-dark-red">{error}</span>}
    </div>
  );
}
