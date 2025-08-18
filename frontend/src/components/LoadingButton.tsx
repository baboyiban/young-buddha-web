import LoadingSpinner from './LoadingSpinner'

interface LoadingButtonProps {
  loading: boolean
  children: React.ReactNode
  className?: string
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

export default function LoadingButton({
  loading,
  children,
  className = '',
  onClick,
  type = 'button',
  disabled = false
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={`${className} ${loading || disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading ? (
        <>처리중...</>
      ) : (
        children
      )}
    </button>
  )
}