const std = @import("std");
const Env = @import("src/config/env.zig").Env;

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    std.debug.print("=== Debug Environment Loading ===\n", .{});

    var env = try Env.init(allocator);
    defer env.deinit();

    std.debug.print("Environment variables loaded:\n", .{});

    const vars = [_][]const u8{
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
        "JWT_SECRET",
    };

    for (vars) |var_name| {
        if (env.get(var_name)) |value| {
            std.debug.print("{s}: '{s}' (len={})\n", .{ var_name, value, value.len });
        } else {
            std.debug.print("{s}: NOT FOUND\n", .{var_name});
        }
    }
}
