const std = @import("std");

pub fn get_env_var_from_file(
    allocator: std.mem.Allocator,
    key: []const u8,
    path: []const u8,
) !?[]u8 {
    var file = try std.fs.cwd().openFile(path, .{});
    defer file.close();

    var buf: [1024]u8 = undefined;
    const n = try file.readAll(&buf);
    const content = buf[0..n];

    var lines = std.mem.splitSequence(u8, content, "\n");
    while (lines.next()) |line| {
        if (std.mem.startsWith(u8, line, key)) {
            if (std.mem.indexOf(u8, line, "=")) |eq_idx| {
                return (try allocator.dupe(u8, std.mem.trim(u8, line[eq_idx + 1 ..], " \r\n")));
            }
        }
    }
    return null;
}
