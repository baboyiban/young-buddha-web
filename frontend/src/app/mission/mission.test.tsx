await import("../../test/setup");

const { mock, describe, it, expect, beforeEach } = await import("bun:test");
import { MissionData } from "@/lib/types/mission";

// Import testing helpers after setup to ensure global document exists
const { render, screen } = await import("@testing-library/react");

// Ensure next/router is mocked for this test (reinforce setup)
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: (globalThis as any).fn(),
    replace: (globalThis as any).fn(),
    prefetch: (globalThis as any).fn(),
    back: (globalThis as any).fn(),
    forward: (globalThis as any).fn(),
    refresh: (globalThis as any).fn(),
  }),
  useSearchParams: () => ({
    get: (globalThis as any).fn(),
    has: (globalThis as any).fn(),
    getAll: (globalThis as any).fn(),
    keys: (globalThis as any).fn(),
    values: (globalThis as any).fn(),
    entries: (globalThis as any).fn(),
    forEach: (globalThis as any).fn(),
    toString: (globalThis as any).fn(),
  }),
  usePathname: () => "/",
}));

// Ensure PageLayout is mocked for this test and respect loading/error props
mock.module("@/components/layouts/PageLayout", () => ({
  default: function MockPageLayout({ children, loading, error }: any) {
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    return <div data-testid="page-layout">{children}</div>;
  },
}));

// SWR 모듈을 bun 방식으로 mock (must happen before importing the page)
const mockedUseSWR = (globalThis as any).jest.fn();
mock.module("swr", () => ({ default: mockedUseSWR }));

const { default: Mission } = await import("./page");

describe("Mission Page", () => {
  beforeEach(() => {
    mockedUseSWR.mockClear();
  });

  it("로딩 상태를 올바르게 표시한다", () => {
    mockedUseSWR.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      mutate: (globalThis as any).fn(),
      isValidating: false,
    });

    const { getByText } = render(<Mission />);
    expect(getByText("Loading...")).toBeInTheDocument();
  });

  it("에러 상태를 올바르게 표시한다", () => {
    mockedUseSWR.mockReturnValue({
      data: undefined,
      error: new Error("API Error"),
      isLoading: false,
      mutate: (globalThis as any).fn(),
      isValidating: false,
    });

    const { getByText } = render(<Mission />);
    expect(
      getByText("Error: 미션 데이터를 불러오는데 실패했습니다."),
    ).toBeInTheDocument();
  });

  it("미션 데이터가 없을 때 안내 메시지를 표시한다", () => {
    mockedUseSWR.mockReturnValue({
      data: { date: "" } as MissionData,
      error: null,
      isLoading: false,
      mutate: (globalThis as any).fn(),
      isValidating: false,
    });

    const { getByText } = render(<Mission />);
    expect(
      getByText(/오늘의 미션 데이터가 아직 준비되지 않았습니다/),
    ).toBeInTheDocument();
  });
});
