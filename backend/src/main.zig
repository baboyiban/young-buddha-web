const std = @import("std");
const zap = @import("zap");
const Router = @import("router/router.zig").Router;
const registerRoutes = @import("router/router.zig").registerRoutes;
const SessionService = @import("service/session_service.zig").SessionService;
const OAuthHandler = @import("handler/oauth_handler.zig").OAuthHandler;
const OAuthController = @import("controller/oauth_controller.zig").OAuthController;
const OAuthService = @import("service/oauth_service.zig").OAuthService;
const StaticHandler = @import("handler/static_handler.zig").StaticHandler;
const Env = @import("config/env.zig").Env;

var global_router: ?Router = null;
pub var global_oauth_handler: ?*OAuthHandler = null;
pub var global_session_service: ?*SessionService = null;
pub var global_static_handler: ?*StaticHandler = null;

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
    global_session_service = &session_service;

    var oauth_service = try OAuthService.init(allocator, env);
    var oauth_controller = OAuthController.init(&oauth_service, &session_service);
    var oauth_handler = OAuthHandler.init(&oauth_controller);
    global_oauth_handler = &oauth_handler;

    var static_handler = try StaticHandler.init(allocator, env);
    defer static_handler.deinit();
    global_static_handler = &static_handler;

    var router = Router.init(allocator);
    defer router.deinit();

    try registerRoutes(&router);

    global_router = router;

    var listener = zap.HttpListener.init(.{
        .port = 8080,
        .on_request = requestCallback,
        .log = true,
    });
    try listener.listen();

    zap.start(.{ .threads = 1, .workers = 1 });
}
