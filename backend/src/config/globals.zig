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

pub fn validateEnvironment() !void {
    const required_vars = [_][]const u8{
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
        "JWT_SECRET",
    };

    const optional_vars = [_][]const u8{
        "DATABASE_URL",
        "NODE_ENV",
        "PORT",
    };

    std.log.info("=== Environment Variables Validation ===", .{});

    var missing_vars = std.ArrayList([]const u8).init(allocator);
    defer missing_vars.deinit();

    for (required_vars) |var_name| {
        if (getEnv().get(var_name)) |value| {
            // 값이 있지만 비어있는지 확인
            if (value.len == 0) {
                std.log.warn("{s}: EMPTY", .{var_name});
                try missing_vars.append(var_name);
            } else {
                // 민감한 정보는 일부만 표시
                if (std.mem.indexOf(u8, var_name, "SECRET") != null or
                    std.mem.indexOf(u8, var_name, "CLIENT_SECRET") != null)
                {
                    std.log.info("{s}: ***{s} (length: {})", .{ var_name, value[value.len - 4 ..], value.len });
                } else {
                    std.log.info("{s}: {s}", .{ var_name, value });
                }
            }
        } else {
            std.log.err("{s}: NOT SET", .{var_name});
            try missing_vars.append(var_name);
        }
    }

    if (missing_vars.items.len > 0) {
        std.log.err("Missing required environment variables: {any}", .{missing_vars.items});
        return error.MissingRequiredEnvironmentVariables;
    }

    // 선택적 환경변수 확인
    std.log.info("=== Optional Environment Variables ===", .{});
    for (optional_vars) |var_name| {
        if (getEnv().get(var_name)) |value| {
            std.log.info("{s}: {s}", .{ var_name, value });
        } else {
            std.log.info("{s}: NOT SET (using default)", .{var_name});
        }
    }

    std.log.info("All required environment variables are set", .{});
}
