import { render, screen } from "@testing-library/react";
import Mission from "./page";
import useSWR from "swr";
import { vi } from "vitest";

vi.mock("swr");

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
