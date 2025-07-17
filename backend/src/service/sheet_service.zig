const std = @import("std");

pub const SheetService = struct {
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) SheetService {
        return .{
            .allocator = allocator,
        };
    }

    pub fn getSpreadsheetValues(
        self: *SheetService,
        access_token: []const u8,
        spreadsheet_id: []const u8,
        range: []const u8,
    ) ![]u8 {
        var client: std.http.Client = .{ .allocator = self.allocator };
        defer client.deinit();

        const url = try std.fmt.allocPrint(
            self.allocator,
            "https://sheets.googleapis.com/v4/spreadsheets/{s}/values/{s}",
            .{ spreadsheet_id, range },
        );
        defer self.allocator.free(url);

        const uri = try std.Uri.parse(url);
        var server_header_buffer: [16 * 1024]u8 = undefined;

        // Authorization 헤더 추가
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

        // HTTP 상태 코드 확인
        if (req.response.status != .ok) {
            const error_response = try req.reader().readAllAlloc(self.allocator, 10 * 1024);
            defer self.allocator.free(error_response);

            // Google API 에러를 JSON 형태로 반환
            const error_json = try std.fmt.allocPrint(self.allocator, "{{\"error\":true,\"message\":\"Google Sheets API error: {d}\",\"details\":\"{s}\"}}", .{ @intFromEnum(req.response.status), error_response });
            return error_json;
        }

        const response = try req.reader().readAllAlloc(self.allocator, 10 * 1024);

        // 응답이 JSON인지 확인 (간단한 체크)
        if (response.len == 0 or response[0] != '{') {
            const error_json = try std.fmt.allocPrint(self.allocator, "{{\"error\":true,\"message\":\"Invalid response format\",\"details\":\"{s}\"}}", .{response});
            self.allocator.free(response);
            return error_json;
        }

        return response;
    }

    pub fn writeSpreadsheetValues(
        self: *SheetService,
        access_token: []const u8,
        request_body: []const u8,
    ) ![]u8 {
        // JSON에서 필요한 값들 추출
        const spreadsheet_id = self.extractJsonField(request_body, "spreadsheet_id") orelse {
            return try std.fmt.allocPrint(self.allocator, "{{\"error\":true,\"message\":\"Missing spreadsheet_id\"}}", .{});
        };
        defer self.allocator.free(spreadsheet_id);

        const range = self.extractJsonField(request_body, "range") orelse {
            return try std.fmt.allocPrint(self.allocator, "{{\"error\":true,\"message\":\"Missing range\"}}", .{});
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

        // Authorization 헤더 추가
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

        // HTTP 상태 코드 확인
        if (req.response.status != .ok) {
            const error_response = try req.reader().readAllAlloc(self.allocator, 10 * 1024);
            defer self.allocator.free(error_response);

            const error_json = try std.fmt.allocPrint(self.allocator, "{{\"error\":true,\"message\":\"Google Sheets API error: {d}\",\"details\":\"{s}\"}}", .{ @intFromEnum(req.response.status), error_response });
            return error_json;
        }

        const response = try req.reader().readAllAlloc(self.allocator, 10 * 1024);

        // 성공 응답 반환
        if (response.len == 0 or response[0] != '{') {
            return try std.fmt.allocPrint(self.allocator, "{{\"success\":true,\"message\":\"Data saved successfully\"}}", .{});
        }

        return response;
    }

    fn extractJsonField(self: *SheetService, json: []const u8, field: []const u8) ?[]u8 {
        const search_key = std.fmt.allocPrint(self.allocator, "\"{s}\":", .{field}) catch return null;
        defer self.allocator.free(search_key);

        if (std.mem.indexOf(u8, json, search_key)) |start| {
            const val_start = start + search_key.len;
            if (val_start >= json.len) return null;

            // 공백 건너뛰기
            var i = val_start;
            while (i < json.len and (json[i] == ' ' or json[i] == '\t' or json[i] == '\n')) : (i += 1) {}

            if (i >= json.len) return null;

            if (json[i] == '"') {
                // 문자열 값
                i += 1;
                const str_start = i;
                while (i < json.len and json[i] != '"') : (i += 1) {}
                if (i >= json.len) return null;
                return std.fmt.allocPrint(self.allocator, "{s}", .{json[str_start..i]}) catch null;
            }
        }
        return null;
    }

    fn createSheetsApiBody(self: *SheetService, request_body: []const u8) ![]u8 {
        // values 필드 추출
        const values_start = std.mem.indexOf(u8, request_body, "\"values\":") orelse {
            return try std.fmt.allocPrint(self.allocator, "{{\"values\":[]}}", .{});
        };

        const values_json_start = values_start + "\"values\":".len;
        var bracket_count: i32 = 0;
        var i = values_json_start;

        // 공백 건너뛰기
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
};
