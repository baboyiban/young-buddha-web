import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  message?: string;
  size?: "xs" | "sm" | "md" | "lg";
  color?: "purple" | "white" | "current";
  showMessage?: boolean;
  className?: string;
}

export default function LoadingSpinner({
  message = "",
  size = "md",
  color = "purple",
  showMessage = true,
  className = "",
}: LoadingSpinnerProps) {
  const sizeClasses = {
    xs: "size-3",
    sm: "size-4",
    md: "size-6",
    lg: "size-8",
  };

  const colorClasses = {
    purple: "text-purple-600",
    white: "text-white",
    current: "text-current",
  };

  return (
    <div
      className={cn("flex items-center justify-center gap-2", className)}
    >
      <Spinner className={cn(sizeClasses[size], colorClasses[color])} />
      {showMessage && message && <span>{message}</span>}
    </div>
  );
}