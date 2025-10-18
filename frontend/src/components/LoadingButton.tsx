import * as React from "react"
import { Button } from "@/components/ui/button"
import LoadingSpinner from "@/components/LoadingSpinner"
import { cn } from "@/lib/utils"

interface LoadingButtonProps {
  loading?: boolean
  children: React.ReactNode
  className?: string
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg"
}

export default function LoadingButton({
  loading = false,
  children,
  className,
  onClick,
  type = 'button',
  disabled = false,
  variant = "default",
  size = "default"
}: LoadingButtonProps) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      variant={variant}
      size={size}
      className={cn(className)}
    >
      {loading && <LoadingSpinner className="mr-2 h-4 w-4" />}
      {loading ? "처리중..." : children}
    </Button>
  )
}