const std = @import("std");
const sqlite = @import("sqlite");
const Env = @import("../config/env.zig").Env;
const globals = @import("../config/globals.zig");
const auth = @import("../auth/app.zig");
const sheets = @import("../sheets/app.zig");
const database = @import("../database/app.zig");
const payment = @import("../payment/app.zig");
const StaticHandler = @import("../handler/static_handler.zig").StaticHandler;
const Logger = @import("../util/logger.zig").Logger;
const constants = @import("../config/constants.zig");

const logger = Logger.init("AppContext");

/// 애플리케이션의 모든 컴포넌트를 관리하는 컨텍스트
pub const AppContext = struct {
    allocator: std.mem.Allocator,
    env: Env,
    db: sqlite.Db,
    auth_app: auth.AuthApp,
    sheets_app: sheets.SheetsApp,
    payment_app: payment.PaymentApp,
    database_app: database.DatabaseApp,
    static_handler: StaticHandler,

    /// 애플리케이션 컨텍스트를 초기화합니다.
    pub fn init(allocator: std.mem.Allocator) !AppContext {
        logger.info("Initializing application context...", .{});

        // 환경 변수 초기화
        var env = Env.init(allocator) catch |err| {
            logger.err("Failed to initialize environment: {any}", .{err});
            return err;
        };
        errdefer env.deinit();

        // 전역 변수 초기화
        globals.init(allocator, &env) catch |err| {
            logger.err("Failed to initialize globals: {any}", .{err});
            return err;
        };

        // 데이터베이스 초기화
        const db_path = env.get("DATABASE_URL") orelse constants.DEFAULT_DB_PATH;
        logger.info("Initializing database: {s}", .{db_path});

        var db = sqlite.Db.init(.{
            .mode = sqlite.Db.Mode{ .File = db_path },
            .open_flags = .{ .write = true, .create = true },
            .threading_mode = .Serialized,
        }) catch |err| {
            logger.err("Failed to initialize database: {any}", .{err});
            return err;
        };
        errdefer db.deinit();

        // 앱 컴포넌트들 초기화
        var auth_app = auth.AuthApp{
            .service = undefined,
            .controller = undefined,
        };
        auth_app.init(allocator) catch |err| {
            logger.err("Failed to initialize auth app: {any}", .{err});
            return err;
        };

        var sheets_app = sheets.SheetsApp{
            .service = undefined,
            .controller = undefined,
        };
        sheets_app.init(allocator, &auth_app.service);

        const payment_spreadsheet_id = env.get("PAYMENT_SHEET_ID") orelse "1x5wH551SVWQqiOXAZD78eLscS9gcBDDKeKkREV6fiSo";
        var payment_app = payment.PaymentApp{
            .service = undefined,
            .controller = undefined,
        };
        payment_app.init(allocator, &sheets_app.service, payment_spreadsheet_id);

        var database_app = database.DatabaseApp{
            .service = undefined,
            .controller = undefined,
        };
        database_app.init(allocator, &db) catch |err| {
            logger.err("Failed to initialize database app: {any}", .{err});
            return err;
        };

        const static_handler = StaticHandler.init(allocator) catch |err| {
            logger.err("Failed to initialize static handler: {any}", .{err});
            return err;
        };

        logger.info("Application context initialized successfully", .{});

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

    /// 애플리케이션 컨텍스트를 정리합니다.
    pub fn deinit(self: *AppContext) void {
        logger.info("Cleaning up application context...", .{});

        self.auth_app.deinit();
        self.db.deinit();
        self.env.deinit();

        logger.info("Application context cleaned up", .{});
    }

    /// 서버 포트를 반환합니다.
    pub fn getPort(self: *AppContext) u16 {
        return self.env.getInt("PORT", u16, constants.DEFAULT_PORT);
    }

    /// 개발 모드인지 확인합니다.
    pub fn isDevelopment(self: *AppContext) bool {
        return !self.env.isProduction();
    }
};
