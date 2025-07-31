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
    router.route(r) catch |err| {
        std.log.err("Route error: {any}", .{err});
        // 에러 응답 전송
        r.setStatusNumeric(500);
        try r.sendBody("Internal Server Error");
    };
}

const AppContext = struct {
    allocator: std.mem.Allocator,
    env: Env,
    db: sqlite.Db,
    auth_app: auth.AuthApp,
    sheets_app: sheets.SheetsApp,
    payment_app: payment.PaymentApp,
    database_app: database.DatabaseApp,
    static_handler: StaticHandler,

    fn init(allocator: std.mem.Allocator) !AppContext {
        // 환경 변수 초기화
        var env = try Env.init(allocator);
        errdefer env.deinit();

        // 전역 변수 초기화
        try globals.init(allocator, &env);

        // 데이터베이스 초기화
        var db = try sqlite.Db.init(.{
            .mode = sqlite.Db.Mode{ .File = "app.db" },
            .open_flags = .{ .write = true, .create = true },
            .threading_mode = .Serialized,
        });
        errdefer db.deinit();

        // 앱 컴포넌트들 초기화
        var auth_app = auth.AuthApp{};
        try auth_app.init(allocator);

        var sheets_app = sheets.SheetsApp{};
        sheets_app.init(allocator, &auth_app.service);

        const payment_spreadsheet_id = env.get("PAYMENT_SHEET_ID") orelse "1x5wH551SVWQqiOXAZD78eLscS9gcBDDKeKkREV6fiSo";
        var payment_app = payment.PaymentApp{};
        payment_app.init(allocator, &sheets_app.service, payment_spreadsheet_id);

        var database_app = database.DatabaseApp{};
        try database_app.init(allocator, &db);

        const static_handler = try StaticHandler.init(allocator);

        return AppContext{
            .allocator = allocator,
            .env = env,
            .db = db,
            .auth_app = auth_app,
            .sheets_app = sheets_app,
            .payment_app = payment_app,
            .database_app = database_app,
            .static_handler = static_handler,
        };
    }

    fn deinit(self: *AppContext) void {
        self.db.deinit();
        self.env.deinit();
    }
};

fn initializeServer(ctx: *AppContext) !void {
    // 전역 컨트롤러 등록
    globals.setControllers(
        &ctx.auth_app.controller,
        &ctx.sheets_app.controller,
        &ctx.static_handler,
        &ctx.database_app.controller,
        &ctx.payment_app.controller,
    );

    // 라우터 초기화 및 등록
    var router = Router.init(ctx.allocator);
    defer router.deinit();

    try setupRoutes(&router);
    global_router = router;
}

fn startHttpServer(ctx: *AppContext) !void {
    const port = ctx.env.getInt("PORT", u16, 8080);
    std.log.info("Starting server on port {d}", .{port});

    var listener = zap.HttpListener.init(.{
        .port = port,
        .on_request = requestCallback,
        .log = true,
    });

    try listener.listen();
    std.log.info("Server started successfully on port {d}", .{port});

    zap.start(.{ .threads = 1, .workers = 1 });
}

pub fn main() !void {
    std.log.info("Starting Young Buddha Web Server...", .{});

    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var ctx = AppContext.init(allocator) catch |err| {
        std.log.err("Failed to initialize application context: {any}", .{err});
        return err;
    };
    defer ctx.deinit();

    initializeServer(&ctx) catch |err| {
        std.log.err("Failed to initialize server: {any}", .{err});
        return err;
    };

    startHttpServer(&ctx) catch |err| {
        std.log.err("Failed to start HTTP server: {any}", .{err});
        return err;
    };

    std.log.info("Server shutdown", .{});
}
