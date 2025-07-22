import { includeComponent } from "../components/loader";
import { setupNavbar } from "../components/navbar";
import { LayoutType } from "./types";

class LayoutManager {
  private currentLayout: LayoutType | null = null;

  async loadLayout(layoutType: LayoutType): Promise<void> {
    console.log(`레이아웃 로드 시작: ${layoutType}`);

    // 이미 같은 레이아웃이 로드되어 있다면 스킵
    if (this.currentLayout === layoutType) {
      console.log("이미 같은 레이아웃이 로드됨, 스킵");
      return;
    }

    const appContainer = document.getElementById("app-container");
    if (!appContainer) {
      console.error("app-container를 찾을 수 없음");
      throw new Error("App container not found");
    }

    // 레이아웃 HTML 로드
    const layoutPath = `/layouts/${layoutType}-layout.html`;
    console.log(`레이아웃 파일 로드: ${layoutPath}`);

    const response = await fetch(layoutPath);
    if (!response.ok) {
      console.error(`레이아웃 파일 로드 실패: ${response.status}`);
      throw new Error(`Failed to load layout: ${layoutPath}`);
    }

    const layoutHtml = await response.text();
    console.log("레이아웃 HTML 로드 완료");

    // 컨테이너에 레이아웃 삽입
    appContainer.innerHTML = layoutHtml;
    console.log("레이아웃 HTML 삽입 완료");

    // 앱 레이아웃인 경우 navbar와 footer 컴포넌트 로드
    if (layoutType === LayoutType.APP) {
      console.log("navbar와 footer 컴포넌트 로드 중...");
      await Promise.all([
        includeComponent("navbar", "navbar.html", setupNavbar),
        includeComponent("footer", "footer.html"),
      ]);
      console.log("컴포넌트 로드 완료");
    }

    this.currentLayout = layoutType;
    console.log(`레이아웃 로드 완료: ${layoutType}`);
  }

  getCurrentLayout(): LayoutType | null {
    return this.currentLayout;
  }

  isLayoutLoaded(layoutType: LayoutType): boolean {
    return this.currentLayout === layoutType;
  }
}

export const layoutManager = new LayoutManager();
