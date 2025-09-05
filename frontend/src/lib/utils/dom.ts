// lib/utils/dom.ts
export function scrollToTop(smooth: boolean = true): void {
  window.scrollTo({
    top: 0,
    behavior: smooth ? "smooth" : "auto",
  });
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false);
  }

  // Fallback for older browsers
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return Promise.resolve(success);
  } catch {
    return Promise.resolve(false);
  }
}

export function getViewportSize(): { width: number; height: number } {
  return {
    width: Math.max(
      document.documentElement.clientWidth || 0,
      window.innerWidth || 0,
    ),
    height: Math.max(
      document.documentElement.clientHeight || 0,
      window.innerHeight || 0,
    ),
  };
}

export function isMobile(): boolean {
  return getViewportSize().width < 768;
}
