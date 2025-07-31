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

pub fn main() !void {
    std.log.info("Starting Young Buddha Web Server...", .{});

    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();

    // 환경 변수 초기화
    var env = Env.init(allocator) catch |err| {
        std.log.err("Failed to initialize environment: {any}", .{err});
        return err;
    };
    defer env.deinit();

    // 전역 변수 초기화
    globals.init(allocator, &env) catch |err| {
        std.log.err("Failed to initialize globals: {any}", .{err});
        return err;
    };

    // Auth, Sheets 초기화
    const auth_app = allocator.create(auth.AuthApp) catch |err| {
        std.log.err("Failed to create auth app: {any}", .{err});
        return err;
    };
    auth_app.init(allocator) catch |err| {
        std.log.err("Failed to initialize auth app: {any}", .{err});
        return err;
    };

    const sheets_app = allocator.create(sheets.SheetsApp) catch |err| {
        std.log.err("Failed to create sheets app: {any}", .{err});
        return err;
    };
    sheets_app.init(allocator, &auth_app.service);

    // Payment 서비스
    const payment_spreadsheet_id = env.get("PAYMENT_SHEET_ID") orelse "1x5wH551SVWQqiOXAZD78eLscS9gcBDDKeKkREV6fiSo";
    const payment_app = allocator.create(payment.PaymentApp) catch |err| {
        std.log.err("Failed to create payment app: {any}", .{err});
        return err;
    };
    payment_app.init(allocator, &sheets_app.service, payment_spreadsheet_id);

    // Database 서비스
    var db = sqlite.Db.init(.{
        .mode = sqlite.Db.Mode{ .File = "app.db" },
        .open_flags = .{ .write = true, .create = true },
        .threading_mode = .Serialized,
    }) catch |err| {
        std.log.err("Failed to initialize database: {any}", .{err});
        return err;
    };
    defer db.deinit();

    const database_app = allocator.create(database.DatabaseApp) catch |err| {
        std.log.err("Failed to create database app: {any}", .{err});
        return err;
    };
    database_app.init(allocator, &db) catch |err| {
        std.log.err("Failed to initialize database app: {any}", .{err});
        return err;
    };

    // 정적 파일 핸들러
    const static_handler = allocator.create(StaticHandler) catch |err| {
        std.log.err("Failed to create static handler: {any}", .{err});
        return err;
    };
    static_handler.* = StaticHandler.init(allocator) catch |err| {
        std.log.err("Failed to initialize static handler: {any}", .{err});
        return err;
    };

    // 전역 컨트롤러 등록
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

    setupRoutes(&router) catch |err| {
        std.log.err("Failed to setup routes: {any}", .{err});
        return err;
    };

    global_router = router;

    // 포트 설정 (환경 변수에서 읽거나 기본값 8080 사용)
    const port = env.getInt("PORT", u16, 8080);

    std.log.info("Attempting to start server on port {d}", .{port});

    // HTTP 리스너 초기화
    var listener = zap.HttpListener.init(.{
        .port = port,
        .on_request = requestCallback,
        .log = true,
    });

    listener.listen() catch |err| {
        std.log.err("Failed to start listener on port {d}: {any}", .{ port, err });
        std.log.err("This could be due to:", .{});
        std.log.err("1. Port {d} is already in use by another process", .{port});
        std.log.err("2. Insufficient permissions to bind to port {d}", .{port});
        std.log.err("3. Invalid port number {d}", .{port});
        std.log.err("Check if another process is using the port with: lsof -i :{d}", .{port});
        std.log.err("Or try running with a different port using PORT environment variable", .{});
        return err;
    };

    std.log.info("Server started on port {d}", .{port});

    // 서버 시작
    zap.start(.{ .threads = 1, .workers = 1 });

    defer _ = gpa.deinit();

    std.log.info("Server shutdown", .{});
}
