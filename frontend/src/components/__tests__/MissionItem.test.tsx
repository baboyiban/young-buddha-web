import { JSDOM } from "jsdom";

if (typeof globalThis.document === "undefined") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).navigator = dom.window.navigator;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  (globalThis as any).Node = dom.window.Node;
}

import { render, screen } from "@testing-library/react";
import { MissionItem } from "../MissionItem";

describe("MissionItem", () => {
  it("제목과 멤버를 올바르게 렌더링한다", () => {
    render(
      <MissionItem title="🍚 발우공양 당번" members={["김철수", "이영희"]} />,
    );

    expect(screen.getByText("🍚 발우공양 당번")).toBeInTheDocument();
    expect(screen.getByText("김철수, 이영희")).toBeInTheDocument();
  });

  it("멤버가 한 명일 때 올바르게 렌더링한다", () => {
    render(<MissionItem title="🧼 아침 설거지" members={["박민수"]} />);

    expect(screen.getByText("🧼 아침 설거지")).toBeInTheDocument();
    expect(screen.getByText("박민수")).toBeInTheDocument();
  });

  it("멤버가 없을 때 빈 상태를 처리한다", () => {
    render(<MissionItem title="🌙 닫는 모임 진행" members={[]} />);

    expect(screen.getByText("🌙 닫는 모임 진행")).toBeInTheDocument();
    // 빈 멤버 배열의 경우 members.join(', ')이 빈 문자열이 됨
    expect(screen.getAllByText("🌙 닫는 모임 진행")).toHaveLength(1);
  });
});
