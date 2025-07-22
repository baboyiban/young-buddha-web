const std = @import("std");

/// std.json 기반으로 특정 필드 추출
pub fn extractJsonString(allocator: std.mem.Allocator, json: []const u8, key: []const u8) !?[]const u8 {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, json, .{});
    defer parsed.deinit();

    if (parsed.value == .object) {
        var it = parsed.value.object.iterator();
        while (it.next()) |entry| {
            if (std.mem.eql(u8, entry.key_ptr.*, key)) {
                if (entry.value_ptr.* == .string) {
                    return entry.value_ptr.*.string;
                }
            }
        }
    }
    return null;
}

pub fn escapeJsonString(allocator: std.mem.Allocator, input: []const u8) ![]u8 {
    var escaped = std.ArrayList(u8).init(allocator);
    defer escaped.deinit();

    for (input) |char| {
        switch (char) {
            '"' => try escaped.appendSlice("\\\""),
            '\\' => try escaped.appendSlice("\\\\"),
            '\n' => try escaped.appendSlice("\\n"),
            '\r' => try escaped.appendSlice("\\r"),
            '\t' => try escaped.appendSlice("\\t"),
            0x00...0x08, 0x0B, 0x0C, 0x0E...0x1F => {
                try escaped.append(' ');
            },
            else => try escaped.append(char),
        }
    }

    return escaped.toOwnedSlice();
}
