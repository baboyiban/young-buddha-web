const std = @import("std");
const zap = @import("zap");
const Env = @import("env.zig").Env;
const OAuthHandler = @import("handler/oauth.zig").OAuthHandler;
const StaticHandler = @import("handler/static.zig").StaticHandler;

pub const Server = struct {
    allocator: std.mem.Allocator,
    env: Env,
    oauth_handler: OAuthHandler,
    static_handler: StaticHandler,

    pub fn init(allocator: std.mem.Allocator) !Server {
        const env = try Env.init(allocator);
        return .{
            .allocator = allocator,
            .env = env,
            .oauth_handler = try OAuthHandler.init(allocator, env),
            .static_handler = try StaticHandler.init(allocator, env),
        };
    }

    pub fn deinit(self: *Server) void {
        self.oauth_handler.deinit();
        self.static_handler.deinit();
        self.env.deinit();
    }

    pub fn onRequest(self: *Server, r: zap.Request) !void {
        if (r.path) |path| {
            if (std.mem.eql(u8, path, "/auth/google"))
                return try self.oauth_handler.handleGoogleAuth(r);
            if (std.mem.eql(u8, path, "/auth/google/callback"))
                return try self.oauth_handler.handleGoogleCallback(r);
            return try self.static_handler.serve(r);
        }
        r.setStatusNumeric(404);
        try r.sendBody("Not Found");
    }
};
