const std = @import("std");
const Env = @import("env.zig").Env;
const AuthController = @import("../auth/controller.zig").AuthController;
const SheetsController = @import("../sheets/controller.zig").SheetsController;
const StaticHandler = @import("../handler/static_handler.zig").StaticHandler;
const PaymentController = @import("../payment/controller.zig").PaymentController; // 추가

// 전역 상태 관리
pub var allocator: std.mem.Allocator = undefined;
pub var env: ?*Env = null;
pub var jwt_secret: []const u8 = "";

// 전역 컨트롤러들
pub var auth_controller: ?*AuthController = null;
pub var sheets_controller: ?*SheetsController = null;
pub var static_handler: ?*StaticHandler = null;
pub var payment_controller: ?*PaymentController = null;

pub fn init(alloc: std.mem.Allocator, environment: *Env) !void {
    allocator = alloc;
    env = environment;
    jwt_secret = environment.get("JWT_SECRET") orelse return error.MissingJwtSecret;
}

// 변경: payment도 포함
pub fn setControllers(
    auth: *AuthController,
    sheets: *SheetsController,
    static: *StaticHandler,
    payment: *PaymentController,
) void {
    auth_controller = auth;
    sheets_controller = sheets;
    static_handler = static;
    payment_controller = payment;
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
