"use client";

import React, { useState, useCallback, useEffect } from "react";
import { ValidationError } from "@/lib/types/api";

interface UseFormOptions<T> {
  initialValues: T;
  validate?: (values: T) => ValidationError[];
  onSubmit: (values: T) => Promise<void> | void;
}

export function useForm<T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback(
    (field: keyof T, value: any) => {
      setValues((prev) => ({ ...prev, [field]: value }));

      // Clear error when user starts typing
      if (errors[field as string]) {
        setErrors((prev) => ({ ...prev, [field as string]: "" }));
      }
    },
    [errors],
  );

  const setFieldTouched = useCallback((field: keyof T) => {
    setTouched((prev) => ({ ...prev, [field as string]: true }));
  }, []);

  const validateForm = useCallback(() => {
    if (!validate) return true;

    const validationErrors = validate(values);
    const errorMap = validationErrors.reduce(
      (acc, error) => ({
        ...acc,
        [error.field]: error.message,
      }),
      {},
    );

    setErrors(errorMap);
    return validationErrors.length === 0;
  }, [values, validate]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!validateForm()) return;

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validateForm, onSubmit],
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setValue,
    setFieldTouched,
    handleSubmit,
    reset,
    isValid: Object.keys(errors).length === 0,
  };
}

// Context 추가
// Use `any` here to avoid TypeScript incompatibilities with generic keyof T across different consumers.
const FormContext = React.createContext<any>(null);

// debug-friendly version of useFormContext
export const useFormContext = () => {
  const context = React.useContext(FormContext);
  // Debug: always log the context so we can tell whether a provider exists at runtime
  try {
    // Keep logs minimal but informative
    console.debug(
      "[useForm] useFormContext called. context present:",
      !!context,
    );
  } catch {
    // ignore logging failures in restricted environments
  }

  if (!context) {
    // Extra debug hint to aid tracing missing provider issues in browser console
    console.error(
      "[useForm] Missing FormProvider: useFormContext must be used within a FormProvider. " +
        "Ensure the component tree includes <FormProvider initialValues=... onSubmit=...> above form components.",
    );
    throw new Error("useFormContext must be used within a FormProvider");
  }
  return context;
};

// Generic function component for provider
export function FormProvider<T extends Record<string, any>>(
  props: { children: React.ReactNode } & UseFormOptions<T>,
) {
  const { children, initialValues, validate, onSubmit } = props;

  // Initialize the form using the hook and provided props
  const form = useForm<T>({
    initialValues,
    validate,
    onSubmit,
  } as UseFormOptions<T>);

  // Debug: log mount and initial values on client to ensure provider is instantiated
  useEffect(() => {
    try {
      console.debug("[useForm] FormProvider mounted on client", {
        hasForm: !!form,
        initialValuesSnapshot: initialValues,
      });
    } catch {
      // ignore logging failures
    }
  }, [form, initialValues]);

  // Provide the initialized form object to consumers
  return React.createElement(
    FormContext.Provider as any,
    { value: form as any },
    children,
  );
}
