const std = @import("std");
const Env = @import("src/config/env.zig").Env;
const globals = @import("src/config/globals.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    std.log.info("=== Testing initialization order ===", .{});

    // Test 1: Create Env
    std.log.info("1. Creating Env...", .{});
    var env = try Env.init(allocator);
    defer env.deinit();

    std.log.info("2. Env created, checking variables...", .{});
    std.log.info("GOOGLE_CLIENT_ID: {s}", .{env.get("GOOGLE_CLIENT_ID") orelse "NOT FOUND"});
    std.log.info("JWT_SECRET: {s}", .{env.get("JWT_SECRET") orelse "NOT FOUND"});

    // Test 2: Initialize globals
    std.log.info("3. Initializing globals...", .{});
    try globals.init(allocator, &env);
    std.log.info("4. Globals initialized", .{});

    // Test 3: Validate
    std.log.info("5. Validating environment...", .{});
    try globals.validateEnvironment();
    std.log.info("6. Validation passed!", .{});
}
