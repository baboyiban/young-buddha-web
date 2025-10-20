import React from "react";
import {
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField as UIFormField,
} from "@/components/ui/form";

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
    <FormItem className={className}>
      <UIFormField name={htmlFor}>
        <FormLabel htmlFor={htmlFor}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </FormLabel>
        <FormControl>{children}</FormControl>
        {error && <FormMessage>{error}</FormMessage>}
      </UIFormField>
    </FormItem>
  );
}
