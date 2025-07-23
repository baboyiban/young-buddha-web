const std = @import("std");
const AuthController = @import("../auth/controller.zig").AuthController;
const SheetsController = @import("../sheets/controller.zig").SheetsController;
const StaticHandler = @import("../handler/static_handler.zig").StaticHandler;
const DatabaseController = @import("../database/controller.zig").DatabaseController;
const PaymentController = @import("../payment/controller.zig").PaymentController;
const Env = @import("../config/env.zig").Env;

pub var auth_controller: ?*AuthController = null;
pub var sheets_controller: ?*SheetsController = null;
pub var static_handler: ?*StaticHandler = null;
pub var database_controller: ?*DatabaseController = null;
pub var payment_controller: ?*PaymentController = null;

pub fn setControllers(
    auth: *AuthController,
    sheets: *SheetsController,
    static: *StaticHandler,
    database: *DatabaseController,
    payment: *PaymentController,
) void {
    auth_controller = auth;
    sheets_controller = sheets;
    static_handler = static;
    database_controller = database;
    payment_controller = payment;
}

pub var allocator: std.mem.Allocator = undefined;
pub var env: ?*Env = null;
pub var jwt_secret: []const u8 = "";

pub fn init(alloc: std.mem.Allocator, environment: *Env) !void {
    allocator = alloc;
    env = environment;
    jwt_secret = environment.get("JWT_SECRET") orelse return error.MissingJwtSecret;
}

pub fn getEnv() *Env {
    return env.?;
}

pub fn isProduction() bool {
    return getEnv().isProduction();
}

pub fn isDevelopment() bool {
    return !isProduction();
}
