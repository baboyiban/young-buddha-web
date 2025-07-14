const std = @import("std");
const zap = @import("zap");
const main = @import("../main.zig");
const role_guard = @import("../middleware/role_guard.zig");
const sendErrorJson = @import("../handler/error_handler.zig").sendErrorJson;

pub const HandlerFn = *const fn (zap.Request) anyerror!void;

const Route = struct {
    method: []const u8,
    path: []const u8,
    handler: HandlerFn,
};

pub const Router = struct {
    allocator: std.mem.Allocator,
    routes: std.ArrayList(Route),

    pub fn init(allocator: std.mem.Allocator) Router {
        return .{
            .allocator = allocator,
            .routes = std.ArrayList(Route).init(allocator),
        };
    }

    pub fn deinit(self: *Router) void {
        self.routes.deinit();
    }

    pub fn add(self: *Router, method: []const u8, path: []const u8, handler: HandlerFn) !void {
        try self.routes.append(.{ .method = method, .path = path, .handler = handler });
    }

    pub fn get(self: *Router, path: []const u8, handler: HandlerFn) !void {
        try self.add("GET", path, handler);
    }
    pub fn post(self: *Router, path: []const u8, handler: HandlerFn) !void {
        try self.add("POST", path, handler);
    }
    pub fn delete(self: *Router, path: []const u8, handler: HandlerFn) !void {
        try self.add("DELETE", path, handler);
    }

    pub fn route(self: *Router, r: zap.Request) !void {
        if (r.path) |path| {
            // API 라우트 먼저 확인
            for (self.routes.items) |rt| {
                if (std.mem.eql(u8, path, rt.path) and std.mem.eql(u8, r.method.?, rt.method)) {
                    try rt.handler(r);
                    return;
                }
            }

            // API 라우트가 없으면 정적 파일 서빙
            if (!std.mem.startsWith(u8, path, "/api/")) {
                try handleStatic(r);
                return;
            }
        }
        return try sendErrorJson(std.heap.page_allocator, r, 404, "Not found");
    }
};

// 전역 핸들러 인스턴스를 사용하는 함수
fn handleGoogleAuth(r: zap.Request) anyerror!void {
    try main.global_oauth_handler.?.handleGoogleAuth(r);
}
fn handleGoogleCallback(r: zap.Request) anyerror!void {
    try main.global_oauth_handler.?.handleGoogleCallback(r);
}
fn handleMe(r: zap.Request) anyerror!void {
    try main.global_oauth_handler.?.handleMe(r);
}
fn handleLogout(r: zap.Request) anyerror!void {
    try main.global_oauth_handler.?.handleLogout(r);
}
fn handleStatic(r: zap.Request) anyerror!void {
    try main.global_static_handler.?.serve(r);
}

pub fn registerRoutes(router: *Router) !void {
    try router.post("/api/auth/google", handleGoogleAuth);
    try router.get("/api/auth/google/callback", handleGoogleCallback);
    try router.get("/api/auth/me", role_guard.AuthRequired(&.{ "user", "admin" }, handleMe));
    try router.delete("/api/auth/current", role_guard.AuthRequired(&.{ "user", "admin" }, handleLogout));
}
