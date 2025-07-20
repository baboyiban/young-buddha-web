const std = @import("std");
const zap = @import("zap");
const Router = @import("web/router.zig").Router;
const setupRoutes = @import("web/router.zig").setupRoutes;
const Env = @import("config/env.zig").Env;
const globals = @import("config/globals.zig");
const auth = @import("auth/mod.zig");
const sheets = @import("sheets/mod.zig");
const StaticHandler = @import("handler/static_handler.zig").StaticHandler;

pub var global_router: ?Router = null;

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

    // 전역 상태 초기화
    try globals.init(allocator, &env);

    // 서비스 초기화
    var auth_service = try auth.Service.init(allocator, env);
    var sheets_service = sheets.Service.init(allocator, &auth_service);

    // 컨트롤러 초기화
    var auth_controller = auth.Controller.init(&auth_service);
    var sheets_controller = sheets.Controller.init(&sheets_service);

    // 정적 파일 핸들러
    var static_handler = try StaticHandler.init(allocator, env);
    defer static_handler.deinit();

    // 전역 컨트롤러들 설정
    globals.setControllers(&auth_controller, &sheets_controller, &static_handler);

    var router = Router.init(allocator);
    defer router.deinit();

    try setupRoutes(&router);

    global_router = router;

    var listener = zap.HttpListener.init(.{
        .port = 8080,
        .on_request = requestCallback,
        .log = true,
    });
    try listener.listen();

    zap.start(.{ .threads = 1, .workers = 1 });
}
