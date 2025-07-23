const std = @import("std");
const Env = @import("env.zig").Env;
const AuthController = @import("../auth/controller.zig").AuthController;
const SheetsController = @import("../sheets/controller.zig").SheetsController;
const StaticHandler = @import("../handler/static_handler.zig").StaticHandler;
const DatabaseController = @import("../database/controller.zig").DatabaseController; // 추가

// 전역 상태 관리
pub var allocator: std.mem.Allocator = undefined;
pub var env: ?*Env = null;
pub var jwt_secret: []const u8 = "";

// 전역 컨트롤러들
pub var auth_controller: ?*AuthController = null;
pub var sheets_controller: ?*SheetsController = null;
pub var static_handler: ?*StaticHandler = null;
pub var database_controller: ?*DatabaseController = null;

pub fn init(alloc: std.mem.Allocator, environment: *Env) !void {
    allocator = alloc;
    env = environment;
    jwt_secret = environment.get("JWT_SECRET") orelse return error.MissingJwtSecret;
}

pub fn setControllers(
    auth: *AuthController,
    sheets: *SheetsController,
    static: *StaticHandler,
    database: *DatabaseController,
) void {
    auth_controller = auth;
    sheets_controller = sheets;
    static_handler = static;
    database_controller = database;
}

pub fn getEnv() *Env {
    return env.?;
}

pub fn isProduction() bool {
    return getEnv().isProduction();
}

pub fn isDevelopment() bool {
    return getEnv().isDevelopment();
}
