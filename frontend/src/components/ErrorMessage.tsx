interface ErrorMessageProps {
  message: string;
  onDismiss: () => void;
}

export default function ErrorMessage({
  message,
  onDismiss,
}: ErrorMessageProps) {
  return (
    <div className="mx-[0.5rem] p-[1rem] bg-red-50 border border-red-200 rounded-[1rem">
      <div className="flex justify-between items-center">
        <span className="text-red-700">{message}</span>
        <button
          onClick={onDismiss}
          className="text-red-500 hover:text-red-700"
          aria-label="Close error message"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
