const std = @import("std");
const zap = @import("zap");
const Env = @import("config/env.zig").Env;
const Router = @import("router/router.zig").Router;
const OAuthHandler = @import("handler/oauth_handler.zig").OAuthHandler;
const StaticHandler = @import("handler/static_handler.zig").StaticHandler;
const OAuthController = @import("controller/oauth_controller.zig").OAuthController;
const OAuthService = @import("service/oauth_service.zig").OAuthService;
const SessionService = @import("service/session_service.zig").SessionService;

var global_router: ?Router = null;

fn requestCallback(r: zap.Request) anyerror!void {
    const router = &global_router.?;
    try router.route(r);
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var env = try Env.init(allocator);
    defer env.deinit();

    var session_service = SessionService.init(allocator);
    defer session_service.deinit();

    var oauth_service = try OAuthService.init(allocator, env);
    var oauth_controller = OAuthController.init(&oauth_service, &session_service);
    var oauth_handler = OAuthHandler.init(&oauth_controller);

    var static_handler = try StaticHandler.init(allocator, env);

    global_router = Router.init(&oauth_handler, &static_handler);

    var listener = zap.HttpListener.init(.{
        .port = 8080,
        .on_request = requestCallback,
        .log = true,
    });
    try listener.listen();

    std.log.info("Server running on http://localhost:8080", .{});
    zap.start(.{ .threads = 1, .workers = 1 });
}
