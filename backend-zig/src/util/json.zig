const std = @import("std");

/// std.json 기반으로 특정 필드 추출
pub fn extractJsonString(allocator: std.mem.Allocator, json: []const u8, key: []const u8) !?[]u8 {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, json, .{});
    defer parsed.deinit();

    if (parsed.value == .object) {
        var it = parsed.value.object.iterator();
        while (it.next()) |entry| {
            if (std.mem.eql(u8, entry.key_ptr.*, key)) {
                if (entry.value_ptr.* == .string) {
                    // 반드시 복사해서 반환!
                    return try allocator.dupe(u8, entry.value_ptr.*.string);
                }
            }
        }
    }
    return null;
}

/// JSON에서 key에 해당하는 배열을 추출 (std.json.Value 배열 반환)
pub fn extractJsonArray(
    allocator: std.mem.Allocator,
    json: []const u8,
    key: []const u8,
) !?[]std.json.Value {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, json, .{});
    defer parsed.deinit();

    if (parsed.value == .object) {
        if (parsed.value.object.get(key)) |v| {
            if (v == .array) {
                var arr = try allocator.alloc(std.json.Value, v.array.items.len);
                for (v.array.items, 0..) |item, i| {
                    arr[i] = item;
                }
                return arr;
            }
        }
    }
    return null;
}

/// JSON에서 key에 해당하는 2차원 string 배열 추출
pub fn extractString2DArray(
    allocator: std.mem.Allocator,
    json: []const u8,
    key: []const u8,
) !?[][]const u8 {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, json, .{});
    defer parsed.deinit();

    if (parsed.value == .object) {
        if (parsed.value.object.get(key)) |v| {
            if (v == .array) {
                var arr = try allocator.alloc([]const u8, v.array.items.len);
                for (v.array.items, 0..) |row, i| {
                    if (row == .array) {
                        var rowArr = try allocator.alloc([]const u8, row.array.items.len);
                        for (row.array.items, 0..) |cell, j| {
                            if (cell == .string) {
                                rowArr[j] = cell.string;
                            } else {
                                rowArr[j] = "";
                            }
                        }
                        arr[i] = rowArr;
                    } else {
                        arr[i] = &[_][]const u8{};
                    }
                }
                return arr;
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
