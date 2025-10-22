await import("../../../test/setup");
const { describe, it, expect, beforeEach, mock } = await import("bun:test");
const { renderHook, act } = await import("@testing-library/react");
import { User, UserRole } from "@/lib/types/user";

const { useAuth } = await import("../useAuth");

// Convert jest.fn() usages to the provided global mock functions set up in setup.tsx
function asMock(fn: any) {
  return fn as any;
}


// AuthContext 모킹
const mockAuthContext = {
  user: {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
    roles: ["USER" as UserRole],
  } as User,
  loading: false,
  isAuthenticated: true,
  login: (globalThis as any).jest.fn(),
  logout: (globalThis as any).jest.fn(),
  checkAuth: (globalThis as any).jest.fn(),
};

const mockRouter = {
  push: (globalThis as any).jest.fn(),
};

mock.module("@/lib/context/AuthContext", () => ({
  useAuthContext: () => mockAuthContext,
}));

mock.module("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

describe("useAuth", () => {
  beforeEach(() => {
    asMock(mockAuthContext.login).mockClear();
    asMock(mockAuthContext.logout).mockClear();
    asMock(mockAuthContext.checkAuth).mockClear();
    asMock(mockRouter.push).mockClear();
  });

  it("AuthContext의 값을 올바르게 반환한다", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toEqual(mockAuthContext.user);
    expect(result.current.loading).toBe(mockAuthContext.loading);
    expect(result.current.isAuthenticated).toBe(
      mockAuthContext.isAuthenticated,
    );
    expect(result.current.login).toBe(mockAuthContext.login);
    expect(result.current.checkAuth).toBe(mockAuthContext.checkAuth);
  });

  it("logout 시 AuthContext의 logout을 호출하고 라우팅한다", async () => {
    asMock(mockAuthContext.logout).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect((mockAuthContext.logout as any).mock.calls.length).toBe(1);
    expect((mockRouter.push as any).mock.calls[0]).toEqual(["/login"]);
  });

  it("logout이 실패해도 라우팅은 실행된다", async () => {
    asMock(mockAuthContext.logout).mockRejectedValueOnce(new Error("Logout failed"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.logout();
      } catch (e) {
        // swallow the rejection here so the test process doesn't treat it as an unhandled error.
        // We still assert the expected side-effects below.
      }
    });

    expect((mockAuthContext.logout as any).mock.calls.length).toBe(1);
    expect((mockRouter.push as any).mock.calls[0]).toEqual(["/login"]);
  });
});
