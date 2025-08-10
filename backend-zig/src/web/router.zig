const std = @import("std");
const zap = @import("zap");
const globals = @import("../config/globals.zig");
const errors = @import("../error/errors.zig").Errors;
const auth = @import("../auth/router.zig");
const sheets = @import("../sheets/router.zig");
const database = @import("../database/router.zig");
const payment = @import("../payment/router.zig");

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

pub fn setupRoutes(router: *Router) !void {
    try auth.setupRoutes(router, globals.auth_controller.?);
    try sheets.setupRoutes(router, globals.sheets_controller.?);
    try database.setupRoutes(router, globals.database_controller.?);
    try payment.setupRoutes(router, globals.payment_controller.?);
}
