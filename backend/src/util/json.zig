const std = @import("std");

pub fn extractJsonString(json: []const u8, key: []const u8) ?[]const u8 {
    if (std.mem.indexOf(u8, json, key)) |start| {
        const val_start = start + key.len;
        if (val_start >= json.len) return null;
        var val_end = val_start;
        while (val_end < json.len and json[val_end] != '"') : (val_end += 1) {}
        return json[val_start..val_end];
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
