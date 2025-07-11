const std = @import("std");
const zap = @import("zap");
const OAuthHandler = @import("../handler/oauth_handler.zig").OAuthHandler;
const StaticHandler = @import("../handler/static_handler.zig").StaticHandler;

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
        if (r.path) |path| {
            if (std.mem.eql(u8, path, "/auth/google"))
                return try self.oauth_handler.handleGoogleAuth(r);
            if (std.mem.eql(u8, path, "/auth/google/callback"))
                return try self.oauth_handler.handleGoogleCallback(r);
            if (std.mem.eql(u8, path, "/auth/me"))
                return try self.oauth_handler.handleMe(r);
            if (std.mem.eql(u8, path, "/auth/logout"))
                return try self.oauth_handler.handleLogout(r);
            return try self.static_handler.serve(r);
        }
        r.setStatusNumeric(404);
        try r.sendBody("Not Found");
    }
};
