const std = @import("std");
const zap = @import("zap");
const Router = @import("web/router.zig").Router;
const setupRoutes = @import("web/router.zig").setupRoutes;
const Env = @import("config/env.zig").Env;
const globals = @import("config/globals.zig");
const auth = @import("auth/app.zig");
const sheets = @import("sheets/app.zig");
const database = @import("database/app.zig");
const StaticHandler = @import("handler/static_handler.zig").StaticHandler;
const sqlite = @import("sqlite");

pub var global_router: ?Router = null;

fn requestCallback(r: zap.Request) anyerror!void {
    const router = &global_router.?;
    try router.route(r);
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();

    var env = try Env.init(allocator);
    defer env.deinit();

    try globals.init(allocator, &env);

    var db = try sqlite.Db.init(.{
        .mode = sqlite.Db.Mode{ .File = "app.db" },
        .open_flags = .{ .write = true, .create = true },
        .threading_mode = .Serialized,
    });
    defer db.deinit();

    const auth_app = try allocator.create(auth.AuthApp);
    // 1단계: service만 먼저 초기화
    auth_app.service = try auth.Service.init(allocator, &env);
    // 2단계: controller는 반드시 service 필드의 포인터로 초기화
    auth_app.controller = auth.Controller.init(&auth_app.service);

    const sheets_app = try allocator.create(sheets.SheetsApp);
    sheets_app.service = sheets.Service.init(allocator, &auth_app.service);
    sheets_app.controller = sheets.Controller.init(&sheets_app.service);

    const database_app = try allocator.create(database.DatabaseApp);
    database_app.service = database.Service.init(allocator, &db);
    database_app.controller = database.Controller.init(&database_app.service);

    const static_handler = try allocator.create(StaticHandler);
    static_handler.* = try StaticHandler.init(allocator, &env);

    globals.setControllers(
        &auth_app.controller,
        &sheets_app.controller,
        static_handler,
        &database_app.controller,
    );

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

    defer _ = gpa.deinit();
}
