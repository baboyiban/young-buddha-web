const std = @import("std");

const auth = @import("../auth/service.zig");
const json_util = @import("../util/json.zig");

pub const SheetsService = struct {
    allocator: std.mem.Allocator,
    auth_service: *auth.AuthService,

    pub fn init(allocator: std.mem.Allocator, auth_service: *auth.AuthService) SheetsService {
        return .{
            .allocator = allocator,
            .auth_service = auth_service,
        };
    }

    pub fn getSpreadsheetValues(
        self: *SheetsService,
        access_token: []const u8,
        refresh_token: []const u8,
        spreadsheet_id: []const u8,
        range: []const u8,
    ) ![]u8 {

        // URL 디코딩
        const decoded_range = try self.urlDecode(range);
        defer self.allocator.free(decoded_range);

        // 먼저 현재 토큰으로 시도
        const result = try self.callSheetsApi(access_token, spreadsheet_id, decoded_range);

        // 401 오류인 경우 토큰 갱신 시도
        if (std.mem.indexOf(u8, result, "\"error\":true") != null and
            std.mem.indexOf(u8, result, "401") != null)
        {
            if (refresh_token.len > 0) {
                const new_access_token = try self.auth_service.refreshAccessToken(refresh_token);
                defer self.allocator.free(new_access_token);

                return try self.callSheetsApi(new_access_token, spreadsheet_id, decoded_range);
            }
        }

        return result;
    }

    fn callSheetsApi(
        self: *SheetsService,
        access_token: []const u8,
        spreadsheet_id: []const u8,
        range: []const u8,
    ) ![]u8 {
        var client: std.http.Client = .{ .allocator = self.allocator };
        defer client.deinit();

        const encoded_range = try self.urlEncode(range);
        defer self.allocator.free(encoded_range);

        const url = try std.fmt.allocPrint(
            self.allocator,
            "https://sheets.googleapis.com/v4/spreadsheets/{s}/values/{s}",
            .{ spreadsheet_id, encoded_range },
        );
        defer self.allocator.free(url);

        const uri = try std.Uri.parse(url);
        var server_header_buffer: [16 * 1024]u8 = undefined;

        const auth_header = std.http.Header{
            .name = "Authorization",
            .value = try std.fmt.allocPrint(self.allocator, "Bearer {s}", .{access_token}),
        };
        defer self.allocator.free(auth_header.value);

        var req = try client.open(.GET, uri, .{
            .server_header_buffer = &server_header_buffer,
            .extra_headers = &.{auth_header},
        });
        defer req.deinit();

        try req.send();
        try req.finish();
        try req.wait();

        if (req.response.status != .ok) {
            const error_response = try req.reader().readAllAlloc(self.allocator, 10 * 1024);
            defer self.allocator.free(error_response);

            const escaped_details = try json_util.escapeJsonString(self.allocator, error_response);
            defer self.allocator.free(escaped_details);

            return try std.fmt.allocPrint(
                self.allocator,
                "{{\"error\":true,\"message\":\"Google Sheets API error: {d}\",\"details\":\"{s}\"}}",
                .{ @intFromEnum(req.response.status), escaped_details },
            );
        }

        const response = try req.reader().readAllAlloc(self.allocator, 10 * 1024);

        if (response.len == 0 or response[0] != '{') {
            const escaped_response = try json_util.escapeJsonString(self.allocator, response);
            defer self.allocator.free(escaped_response);
            self.allocator.free(response);

            return try std.fmt.allocPrint(
                self.allocator,
                "{{\"error\":true,\"message\":\"Invalid response format\",\"details\":\"{s}\"}}",
                .{escaped_response},
            );
        }

        return response;
    }

    pub fn writeSpreadsheetValues(
        self: *SheetsService,
        access_token: []const u8,
        request_body: []const u8,
    ) ![]u8 {
        // 요청 본문에서 필요한 값들 추출
        // 변경: std.json 기반으로 값 추출
        const spreadsheet_id = try json_util.extractJsonString(self.allocator, request_body, "spreadsheet_id") orelse {
            return try std.fmt.allocPrint(
                self.allocator,
                "{{\"error\":true,\"message\":\"Missing spreadsheet_id\"}}",
                .{},
            );
        };
        defer self.allocator.free(spreadsheet_id);

        const range = try json_util.extractJsonString(self.allocator, request_body, "range") orelse {
            return try std.fmt.allocPrint(
                self.allocator,
                "{{\"error\":true,\"message\":\"Missing range\"}}",
                .{},
            );
        };
        defer self.allocator.free(range);

        var client: std.http.Client = .{ .allocator = self.allocator };
        defer client.deinit();

        const url = try std.fmt.allocPrint(
            self.allocator,
            "https://sheets.googleapis.com/v4/spreadsheets/{s}/values/{s}?valueInputOption=RAW",
            .{ spreadsheet_id, range },
        );
        defer self.allocator.free(url);

        const uri = try std.Uri.parse(url);
        var server_header_buffer: [16 * 1024]u8 = undefined;

        const auth_header = std.http.Header{
            .name = "Authorization",
            .value = try std.fmt.allocPrint(self.allocator, "Bearer {s}", .{access_token}),
        };
        defer self.allocator.free(auth_header.value);

        const content_type_header = std.http.Header{
            .name = "Content-Type",
            .value = "application/json",
        };

        // Google Sheets API에 맞는 요청 본문 생성
        const api_body = try self.createSheetsApiBody(request_body);
        defer self.allocator.free(api_body);

        var req = try client.open(.PUT, uri, .{
            .server_header_buffer = &server_header_buffer,
            .extra_headers = &.{ auth_header, content_type_header },
        });
        defer req.deinit();

        req.transfer_encoding = .{ .content_length = api_body.len };
        try req.send();
        try req.writeAll(api_body);
        try req.finish();
        try req.wait();

        if (req.response.status != .ok) {
            const error_response = try req.reader().readAllAlloc(self.allocator, 10 * 1024);
            defer self.allocator.free(error_response);

            const escaped_details = try json_util.escapeJsonString(self.allocator, error_response);
            defer self.allocator.free(escaped_details);

            return try std.fmt.allocPrint(
                self.allocator,
                "{{\"error\":true,\"message\":\"Google Sheets API error: {d}\",\"details\":\"{s}\"}}",
                .{ @intFromEnum(req.response.status), escaped_details },
            );
        }

        const response = try req.reader().readAllAlloc(self.allocator, 10 * 1024);

        if (response.len == 0 or response[0] != '{') {
            self.allocator.free(response);
            return try std.fmt.allocPrint(
                self.allocator,
                "{{\"success\":true,\"message\":\"Data saved successfully\"}}",
                .{},
            );
        }

        return response;
    }

    // 헬퍼 메서드들
    fn createSheetsApiBody(self: *SheetsService, request_body: []const u8) ![]u8 {
        const values_start = std.mem.indexOf(u8, request_body, "\"values\":") orelse {
            return try std.fmt.allocPrint(self.allocator, "{{\"values\":[]}}", .{});
        };

        const values_json_start = values_start + "\"values\":".len;
        var bracket_count: i32 = 0;
        var i = values_json_start;

        while (i < request_body.len and (request_body[i] == ' ' or request_body[i] == '\t' or request_body[i] == '\n')) : (i += 1) {}

        if (i >= request_body.len or request_body[i] != '[') {
            return try std.fmt.allocPrint(self.allocator, "{{\"values\":[]}}", .{});
        }

        const array_start = i;
        bracket_count = 1;
        i += 1;

        while (i < request_body.len and bracket_count > 0) {
            if (request_body[i] == '[') {
                bracket_count += 1;
            } else if (request_body[i] == ']') {
                bracket_count -= 1;
            }
            i += 1;
        }

        const values_array = request_body[array_start..i];
        return try std.fmt.allocPrint(self.allocator, "{{\"values\":{s}}}", .{values_array});
    }

    fn urlDecode(self: *SheetsService, input: []const u8) ![]u8 {
        var result = std.ArrayList(u8).init(self.allocator);
        defer result.deinit();

        var i: usize = 0;
        while (i < input.len) {
            if (input[i] == '%' and i + 2 < input.len) {
                // %XX 형태의 인코딩 디코딩
                const hex_str = input[i + 1 .. i + 3];
                const decoded_byte = std.fmt.parseInt(u8, hex_str, 16) catch {
                    try result.append(input[i]);
                    i += 1;
                    continue;
                };
                try result.append(decoded_byte);
                i += 3;
            } else if (input[i] == '+') {
                // + -> 공백
                try result.append(' ');
                i += 1;
            } else {
                try result.append(input[i]);
                i += 1;
            }
        }

        return result.toOwnedSlice();
    }

    fn urlEncode(self: *SheetsService, input: []const u8) ![]u8 {
        var result = std.ArrayList(u8).init(self.allocator);
        defer result.deinit();

        for (input) |byte| {
            switch (byte) {
                'A'...'Z', 'a'...'z', '0'...'9', '-', '_', '.', '~' => {
                    try result.append(byte);
                },
                ' ' => {
                    try result.appendSlice("%20");
                },
                '!' => {
                    try result.appendSlice("%21");
                },
                else => {
                    try result.writer().print("%{X:0>2}", .{byte});
                },
            }
        }

        return result.toOwnedSlice();
    }
};
