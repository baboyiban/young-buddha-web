const std = @import("std");
const Env = @import("src/config/env.zig").Env;
const globals = @import("src/config/globals.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    std.log.info("=== Debug Validation ===", .{});

    // Initialize environment
    var env = Env.init(allocator) catch |err| {
        std.log.err("Failed to initialize environment: {any}", .{err});
        return err;
    };
    defer env.deinit();

    std.log.info("Environment initialized", .{});

    // Initialize globals
    globals.init(allocator, &env) catch |err| {
        std.log.err("Failed to initialize globals: {any}", .{err});
        return err;
    };

    std.log.info("Globals initialized", .{});
    std.log.info("Global env pointer: {*}", .{globals.env});
    std.log.info("Global env value: {*}", .{globals.env.?});

    // Test individual variable access
    const required_vars = [_][]const u8{
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
        "JWT_SECRET",
    };

    std.log.info("=== Testing Variable Access ===", .{});
    for (required_vars) |var_name| {
        if (globals.getEnv().get(var_name)) |value| {
            std.log.info("{s}: '{s}' (len: {})", .{ var_name, value, value.len });
        } else {
            std.log.err("{s}: NOT FOUND", .{var_name});
        }
    }

    // Test validation
    std.log.info("=== Testing Validation ===", .{});
    globals.validateEnvironment() catch |err| {
        std.log.err("Validation failed: {any}", .{err});
        return err;
    };

    std.log.info("Validation passed!", .{});
}
