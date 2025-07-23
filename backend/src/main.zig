const std = @import("std");
const zap = @import("zap");
const Router = @import("web/router.zig").Router;
const setupRoutes = @import("web/router.zig").setupRoutes;
const Env = @import("config/env.zig").Env;
const globals = @import("config/globals.zig");
const auth = @import("auth/app.zig");
const sheets = @import("sheets/app.zig");
const sqlite = @import("sqlite");
const database = @import("database/app.zig");
const payment = @import("payment/app.zig");
const StaticHandler = @import("handler/static_handler.zig").StaticHandler;

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

    // Auth, Sheets 초기화
    const auth_app = try allocator.create(auth.AuthApp);
    auth_app.* = try auth.AuthApp.init(allocator, &env);

    const sheets_app = try allocator.create(sheets.SheetsApp);
    sheets_app.* = sheets.SheetsApp.init(allocator, &auth_app.service);

    // Payment 서비스 (Google Sheets 기반)
    const payment_spreadsheet_id = env.get("PAYMENT_SHEET_ID") orelse "1x5wH551SVWQqiOXAZD78eLscS9gcBDDKeKkREV6fiSo";
    const payment_app = try allocator.create(payment.PaymentApp);
    payment_app.* = payment.PaymentApp.init(allocator, &auth_app.service, payment_spreadsheet_id);

    // Database 서비스 (예: SQLite 등)
    var db = try sqlite.Db.init(.{
        .mode = sqlite.Db.Mode{ .File = "app.db" },
        .open_flags = .{ .write = true, .create = true },
        .threading_mode = .Serialized,
    });
    defer db.deinit();

    const database_app = try allocator.create(database.DatabaseApp);
    database_app.* = try database.DatabaseApp.init(allocator, &db);

    // 정적 파일 핸들러
    const static_handler = try allocator.create(StaticHandler);
    static_handler.* = try StaticHandler.init(allocator, &env);

    // 전역 컨트롤러 등록 (database, payment 모두)
    globals.setControllers(
        &auth_app.controller,
        &sheets_app.controller,
        static_handler,
        &database_app.controller,
        &payment_app.controller,
    );

    // 라우터 초기화 및 등록
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
