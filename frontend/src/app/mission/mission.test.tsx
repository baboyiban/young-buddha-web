import { render, screen } from "@testing-library/react";
import Mission from "./page";
import useSWR from "swr";
import { vi } from "vitest";
import { JSDOM } from "jsdom";

// Ensure a DOM environment when running under Node (fallback if vitest env is not jsdom)
if (typeof globalThis.document === "undefined") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).navigator = dom.window.navigator;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  (globalThis as any).Node = dom.window.Node;
}

// Provide a factory mock for swr so the mocking system receives a function
vi.mock("swr", () => {
  return {
    default: vi.fn(),
    __esModule: true,
  };
});

describe("Mission Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("로딩 상태를 올바르게 표시한다", () => {
    // SWR 모킹: useSWR을 직접 모킹
    (useSWR as any).mockImplementation(() => ({
      data: undefined,
      error: null,
      isLoading: true,
    }));

    render(<Mission />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("에러 상태를 올바르게 표시한다", () => {
    (useSWR as any).mockImplementation(() => ({
      data: undefined,
      error: new Error("API Error"),
      isLoading: false,
    }));

    render(<Mission />);
    expect(
      screen.getByText("Error: 미션 데이터를 불러오는데 실패했습니다."),
    ).toBeInTheDocument();
  });

  it("미션 데이터가 없을 때 안내 메시지를 표시한다", () => {
    (useSWR as any).mockImplementation(() => ({
      data: { date: "" },
      error: null,
      isLoading: false,
    }));

    render(<Mission />);
    expect(
      screen.getByText(/오늘의 미션 데이터가 아직 준비되지 않았습니다/),
    ).toBeInTheDocument();
  });
});
