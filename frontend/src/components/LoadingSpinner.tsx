interface LoadingSpinnerProps {
  message?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  color?: 'purple' | 'white' | 'current'
  showMessage?: boolean
  className?: string
}

export default function LoadingSpinner({
  message = "데이터를 불러오는 중...",
  size = 'sm',
  color = 'purple',
  showMessage = true,
  className = ''
}: LoadingSpinnerProps) {
  const sizeClasses = {
    xs: 'size-[0.75rem] border-[0.125rem]',
    sm: 'size-[1rem] border-[0.125rem]',
    md: 'size-[2rem] border-[0.25rem]',
    lg: 'size-[3rem] border-[0.375rem]'
  }

  const colorClasses = {
    purple: 'border-deep-purple border-t-transparent',
    white: 'border-white border-t-transparent',
    current: 'border-current border-t-transparent'
  }

  return (
    <div className={`flex items-center justify-center gap-[0.5rem] ${className}`}>
      <div className={`${sizeClasses[size]} ${colorClasses[color]} animate-spin rounded-full`}></div>
      {showMessage && <span>{message}</span>}
    </div>
  )
}