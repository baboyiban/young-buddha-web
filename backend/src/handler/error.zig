const std = @import("std");
const zap = @import("zap");

pub fn sendError(allocator: std.mem.Allocator, r: zap.Request, status: usize, message: []const u8) !void {
    const json_response = try std.fmt.allocPrint(allocator, "{{\"error\":\"error\",\"message\":\"{s}\"}}", .{message});
    defer allocator.free(json_response);

    r.setStatusNumeric(status);
    try r.setHeader("Content-Type", "application/json; charset=utf-8");
    try r.sendBody(json_response);
}
