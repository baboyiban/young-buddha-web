const std = @import("std");
const zap = @import("zap");
const Router = @import("router/router.zig").Router;
const registerRoutes = @import("router/router.zig").registerRoutes;
const OAuthHandler = @import("handler/oauth_handler.zig").OAuthHandler;
const OAuthController = @import("controller/oauth_controller.zig").OAuthController;
const OAuthService = @import("service/oauth_service.zig").OAuthService;
const StaticHandler = @import("handler/static_handler.zig").StaticHandler;
const Env = @import("config/env.zig").Env;
const SheetService = @import("service/sheet_service.zig").SheetService;
const SheetController = @import("controller/sheet_controller.zig").SheetController;
const SheetHandler = @import("handler/sheet_handler.zig").SheetHandler;

pub var global_router: ?Router = null;
pub var global_oauth_handler: ?*OAuthHandler = null;
pub var global_static_handler: ?*StaticHandler = null;
pub var global_jwt_secret: []const u8 = "";
pub var global_sheet_handler: ?*SheetHandler = null;

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

    // JWT 시크릿 환경변수에서 읽기
    const jwt_secret = env.get("JWT_SECRET") orelse return error.MissingJwtSecret;
    global_jwt_secret = jwt_secret;

    var oauth_service = try OAuthService.init(allocator, env);
    var oauth_controller = OAuthController.init(&oauth_service, jwt_secret);
    var oauth_handler = OAuthHandler.init(&oauth_controller);
    global_oauth_handler = &oauth_handler;

    var static_handler = try StaticHandler.init(allocator, env);
    defer static_handler.deinit();
    global_static_handler = &static_handler;

    var sheet_service = SheetService.init(allocator);
    var sheet_controller = SheetController.init(&sheet_service, jwt_secret);
    var sheet_handler = SheetHandler.init(&sheet_controller);
    global_sheet_handler = &sheet_handler;

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
