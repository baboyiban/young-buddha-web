import { includeComponent } from "../components/loader";
import { setupNavbar } from "../components/navbar";
import { LayoutType } from "./types";

class LayoutManager {
  private currentLayout: LayoutType | null = null;

  async loadLayout(layoutType: LayoutType): Promise<void> {
    // 이미 같은 레이아웃이 로드되어 있다면 스킵
    if (this.currentLayout === layoutType) {
      return;
    }

    const appContainer = document.getElementById("app-container");
    if (!appContainer) {
      console.error("app-container를 찾을 수 없음");
      throw new Error("App container not found");
    }

    // 레이아웃 HTML 로드
    const layoutPath = `/layouts/${layoutType}-layout.html`;

    const response = await fetch(layoutPath);
    if (!response.ok) {
      console.error(`레이아웃 파일 로드 실패: ${response.status}`);
      throw new Error(`Failed to load layout: ${layoutPath}`);
    }

    const layoutHtml = await response.text();

    // 컨테이너에 레이아웃 삽입
    appContainer.innerHTML = layoutHtml;

    // 앱 레이아웃인 경우 navbar와 footer 컴포넌트 로드
    if (layoutType === LayoutType.APP) {
      await Promise.all([
        includeComponent("navbar", "navbar.html", setupNavbar),
        includeComponent("footer", "footer.html"),
      ]);
    }

    this.currentLayout = layoutType;
  }

  getCurrentLayout(): LayoutType | null {
    return this.currentLayout;
  }

  isLayoutLoaded(layoutType: LayoutType): boolean {
    return this.currentLayout === layoutType;
  }
}

export const layoutManager = new LayoutManager();
