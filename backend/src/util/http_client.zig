const std = @import("std");
const Logger = @import("logger.zig").Logger;

const logger = Logger.init("HttpClient");

/// HTTP 클라이언트 유틸리티
pub const HttpClient = struct {
    allocator: std.mem.Allocator,
    client: std.http.Client,

    pub fn init(allocator: std.mem.Allocator) HttpClient {
        return .{
            .allocator = allocator,
            .client = .{ .allocator = allocator },
        };
    }

    pub fn deinit(self: *HttpClient) void {
        self.client.deinit();
    }

    /// GET 요청을 수행합니다
    pub fn get(self: *HttpClient, url: []const u8, headers: ?[]const std.http.Header) ![]u8 {
        const uri = std.Uri.parse(url) catch |err| {
            logger.err("Failed to parse URL: {s}, error: {any}", .{ url, err });
            return error.InvalidUrl;
        };

        var server_header_buffer: [16 * 1024]u8 = undefined;
        var req = self.client.open(.GET, uri, .{
            .server_header_buffer = &server_header_buffer,
            .extra_headers = headers orelse &.{},
        }) catch |err| {
            logger.err("Failed to open GET request to {s}: {any}", .{ url, err });
            return error.HttpRequestFailed;
        };
        defer req.deinit();

        try self.sendAndWait(&req);
        return self.readResponse(&req);
    }

    /// POST 요청을 수행합니다
    pub fn post(self: *HttpClient, url: []const u8, body: []const u8, headers: ?[]const std.http.Header) ![]u8 {
        const uri = std.Uri.parse(url) catch |err| {
            logger.err("Failed to parse URL: {s}, error: {any}", .{ url, err });
            return error.InvalidUrl;
        };

        var server_header_buffer: [16 * 1024]u8 = undefined;
        var req = self.client.open(.POST, uri, .{
            .server_header_buffer = &server_header_buffer,
            .extra_headers = headers orelse &.{},
        }) catch |err| {
            logger.err("Failed to open POST request to {s}: {any}", .{ url, err });
            return error.HttpRequestFailed;
        };
        defer req.deinit();

        req.transfer_encoding = .{ .content_length = body.len };
        try self.sendAndWait(&req);
        req.writeAll(body) catch |err| {
            logger.err("Failed to write request body: {any}", .{err});
            return error.HttpRequestFailed;
        };

        return self.readResponse(&req);
    }

    /// 요청을 보내고 응답을 기다립니다
    fn sendAndWait(self: *HttpClient, req: *std.http.Client.Request) !void {
        _ = self;
        req.send() catch |err| {
            logger.err("Failed to send HTTP request: {any}", .{err});
            return error.HttpRequestFailed;
        };
        req.finish() catch |err| {
            logger.err("Failed to finish HTTP request: {any}", .{err});
            return error.HttpRequestFailed;
        };
        req.wait() catch |err| {
            logger.err("Failed to wait for HTTP response: {any}", .{err});
            return error.HttpRequestFailed;
        };
    }

    /// 응답을 읽습니다
    fn readResponse(self: *HttpClient, req: *std.http.Client.Request) ![]u8 {
        const response = req.reader().readAllAlloc(self.allocator, 10 * 1024) catch |err| {
            logger.err("Failed to read HTTP response: {any}", .{err});
            return error.HttpResponseFailed;
        };

        // 응답 상태 코드 확인
        if (req.response.status != .ok) {
            logger.err("HTTP request failed with status: {any}", .{req.response.status});
            logger.err("Response body: {s}", .{response});
            self.allocator.free(response);
            return error.HttpRequestFailed;
        }

        return response;
    }
};
