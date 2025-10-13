import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../useAuth";
import { User, UserRole } from "@/lib/types/user";

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
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: vi.fn(),
};

const mockRouter = {
  push: vi.fn(),
};

vi.mock("@/lib/context/AuthContext", () => ({
  useAuthContext: () => mockAuthContext,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mockAuthContext.logout.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(mockAuthContext.logout).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith("/login");
  });

  it("logout이 실패해도 라우팅은 실행된다", async () => {
    mockAuthContext.logout.mockRejectedValueOnce(new Error("Logout failed"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.logout();
      } catch (e) {
        // swallow the rejection here so the test process doesn't treat it as an unhandled error.
        // We still assert the expected side-effects below.
      }
    });

    expect(mockAuthContext.logout).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith("/login");
  });
});
