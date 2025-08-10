const std = @import("std");
const zap = @import("zap");

/// HTTP 응답 유틸리티
pub const ResponseHelper = struct {
    /// JSON 응답을 전송합니다
    pub fn sendJson(r: zap.Request, status: u16, json: []const u8) !void {
        r.setStatusNumeric(status);
        try r.setHeader("Content-Type", "application/json; charset=utf-8");
        try r.sendBody(json);
    }

    /// 성공 응답을 전송합니다
    pub fn sendSuccess(allocator: std.mem.Allocator, r: zap.Request, message: []const u8) !void {
        const response = try std.fmt.allocPrint(
            allocator,
            "{{\"success\":true,\"message\":\"{s}\"}}",
            .{message},
        );
        defer allocator.free(response);
        try sendJson(r, 200, response);
    }

    /// 에러 응답을 전송합니다
    pub fn sendError(allocator: std.mem.Allocator, r: zap.Request, status: u16, code: []const u8, message: []const u8) !void {
        const response = try std.fmt.allocPrint(
            allocator,
            "{{\"error\":true,\"code\":\"{s}\",\"message\":\"{s}\"}}",
            .{ code, message },
        );
        defer allocator.free(response);
        try sendJson(r, status, response);
    }

    /// 데이터와 함께 성공 응답을 전송합니다
    pub fn sendData(allocator: std.mem.Allocator, r: zap.Request, data: []const u8) !void {
        const response = try std.fmt.allocPrint(
            allocator,
            "{{\"success\":true,\"data\":{s}}}",
            .{data},
        );
        defer allocator.free(response);
        try sendJson(r, 200, response);
    }
};
