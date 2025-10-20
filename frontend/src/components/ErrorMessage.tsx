import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ErrorMessageProps {
  message: string;
  onDismiss: () => void;
}

export default function ErrorMessage({
  message,
  onDismiss,
}: ErrorMessageProps) {
  return (
    <Alert variant="destructive" className="mx-2">
      <AlertDescription className="flex justify-between items-center">
        <span>{message}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-auto p-1 text-destructive hover:text-destructive"
          aria-label="Close error message"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}