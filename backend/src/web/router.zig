const std = @import("std");
const zap = @import("zap");
const globals = @import("../config/globals.zig");
const auth = @import("../auth/mod.zig");
const sheets = @import("../sheets/mod.zig");
const StaticHandler = @import("../handler/static_handler.zig").StaticHandler;
const errors = @import("../config/errors.zig").Errors;

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

    pub fn get(self: *Router, path: []const u8, handler: HandlerFn) !void {
        try self.routes.append(.{ .method = "GET", .path = path, .handler = handler });
    }

    pub fn post(self: *Router, path: []const u8, handler: HandlerFn) !void {
        try self.routes.append(.{ .method = "POST", .path = path, .handler = handler });
    }

    pub fn delete(self: *Router, path: []const u8, handler: HandlerFn) !void {
        try self.routes.append(.{ .method = "DELETE", .path = path, .handler = handler });
    }

    pub fn route(self: *Router, r: zap.Request) !void {
        if (r.path) |path| {
            for (self.routes.items) |rt| {
                if (std.mem.eql(u8, path, rt.path) and std.mem.eql(u8, r.method.?, rt.method)) {
                    try rt.handler(r);
                    return;
                }
            }

            if (!std.mem.startsWith(u8, path, "/api/")) {
                try globals.static_handler.?.serve(r);
                return;
            }
        }

        const error_json = try std.fmt.allocPrint(
            globals.allocator,
            "{{\"error\":true,\"message\":\"{s}\"}}",
            .{errors.NotFound},
        );
        defer globals.allocator.free(error_json);

        r.setStatusNumeric(404);
        try r.setHeader("Content-Type", "application/json; charset=utf-8");
        try r.sendBody(error_json);
    }
};

// 라우트 핸들러들
fn handleGoogleAuth(r: zap.Request) anyerror!void {
    try globals.auth_controller.?.googleAuth(r);
}

fn handleGoogleCallback(r: zap.Request) anyerror!void {
    try globals.auth_controller.?.googleCallback(r);
}

fn handleMe(r: zap.Request) anyerror!void {
    try globals.auth_controller.?.me(r);
}

fn handleLogout(r: zap.Request) anyerror!void {
    try globals.auth_controller.?.logout(r);
}

fn handleReadSheet(r: zap.Request) anyerror!void {
    try globals.sheets_controller.?.readSheet(r);
}

fn handleWriteSheet(r: zap.Request) anyerror!void {
    try globals.sheets_controller.?.writeSheet(r);
}

pub fn setupRoutes(router: *Router) !void {
    // 인증 라우트
    try router.post("/api/auth/google", handleGoogleAuth);
    try router.get("/api/auth/google/callback", handleGoogleCallback);
    try router.get("/api/auth/me", handleMe);
    try router.delete("/api/auth/logout", handleLogout);

    // 시트 라우트
    try router.get("/api/sheets/read", handleReadSheet);
    try router.post("/api/sheets/write", handleWriteSheet);
}
