const std = @import("std");
const zap = @import("zap");
const OAuthHandler = @import("../handler/oauth_handler.zig").OAuthHandler;
const StaticHandler = @import("../handler/static_handler.zig").StaticHandler;
const sendErrorJson = @import("../handler/error_handler.zig").sendErrorJson;

const Route = struct {
    path: []const u8,
    method: []const u8,
    handler: *const fn (*OAuthHandler, zap.Request) anyerror!void,
};

pub const Router = struct {
    oauth_handler: *OAuthHandler,
    static_handler: *StaticHandler,

    pub fn init(oauth_handler: *OAuthHandler, static_handler: *StaticHandler) Router {
        return .{
            .oauth_handler = oauth_handler,
            .static_handler = static_handler,
        };
    }

    pub fn route(self: *Router, r: zap.Request) !void {
        const routes = [_]Route{
            .{ .path = "/api/auth/google", .method = "POST", .handler = OAuthHandler.handleGoogleAuth },
            .{ .path = "/api/auth/google/callback", .method = "GET", .handler = OAuthHandler.handleGoogleCallback },
            .{ .path = "/api/auth/me", .method = "GET", .handler = OAuthHandler.handleMe },
            .{ .path = "/api/auth/current", .method = "DELETE", .handler = OAuthHandler.handleLogout },
        };

        if (r.path) |path| {
            for (routes) |entry| {
                if (std.mem.eql(u8, path, entry.path) and std.mem.eql(u8, r.method.?, entry.method)) {
                    return try entry.handler(self.oauth_handler, r);
                }
            }
            if (std.mem.startsWith(u8, path, "/api/")) {
                return try sendErrorJson(std.heap.page_allocator, r, 404, "Not found");
            }
            return try self.static_handler.serve(r);
        }
        return try sendErrorJson(std.heap.page_allocator, r, 404, "Not found");
    }
};
