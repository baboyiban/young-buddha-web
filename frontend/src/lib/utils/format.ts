// lib/utils/format.ts
export function formatDate(
  date: string | Date,
  format: "short" | "long" | "korean" = "short",
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (!dateObj || isNaN(dateObj.getTime())) {
    return "";
  }

  switch (format) {
    case "long":
      return dateObj.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });
    case "korean":
      return dateObj.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    case "short":
    default:
      return dateObj.toISOString().split("T")[0]; // YYYY-MM-DD
  }
}

export function formatPaymentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    "": "대기",
    대기: "대기",
    승인: "승인",
    반려: "반려",
  };

  return statusMap[status] || "대기";
}

export function formatUserName(email: string, name?: string): string {
  if (name && name.trim()) {
    return name.trim();
  }

  // 이메일에서 @ 앞부분 추출
  const username = email.split("@")[0];
  return username || "사용자";
}
