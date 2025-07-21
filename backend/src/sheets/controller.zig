const std = @import("std");
const zap = @import("zap");
const Service = @import("service.zig").SheetsService;
const auth = @import("../auth/middleware.zig");
const jwt = @import("../util/jwt.zig");
const globals = @import("../config/globals.zig");
const QueryIterator = @import("../util/query.zig").QueryIterator;
const error_handler = @import("../handler/error_handler.zig");

pub const SheetsController = struct {
    service: *Service,

    pub fn init(service: *Service) SheetsController {
        return .{ .service = service };
    }

    pub fn readSheet(self: *SheetsController, r: zap.Request) !void {
        // JWT에서 access_token과 refresh_token 추출
        const tokens = self.getTokensFromJwt(r) catch |err| {
            return self.handleAuthError(r, err);
        };
        defer {
            self.service.allocator.free(tokens.access_token);
            if (tokens.refresh_token.len > 0) {
                self.service.allocator.free(tokens.refresh_token);
            }
        }

        // 쿼리 파라미터 추출
        const spreadsheet_id = self.getQueryParam(r, "spreadsheet_id") catch {
            return self.sendError(r, 400, "MISSING_SPREADSHEET_ID", "Missing spreadsheet_id parameter");
        };
        const range = self.getQueryParam(r, "range") catch {
            return self.sendError(r, 400, "MISSING_RANGE", "Missing range parameter");
        };

        const values_json = self.service.getSpreadsheetValues(tokens.access_token, tokens.refresh_token, spreadsheet_id, range) catch {
            return self.sendError(r, 500, "READ_FAILED", "Failed to read spreadsheet data");
        };
        defer self.service.allocator.free(values_json);

        try self.sendJson(r, 200, values_json);
    }

    pub fn writeSheet(self: *SheetsController, r: zap.Request) !void {
        // JWT에서 access_token 추출
        const tokens = self.getTokensFromJwt(r) catch |err| {
            return self.handleAuthError(r, err);
        };
        defer {
            self.service.allocator.free(tokens.access_token);
            if (tokens.refresh_token.len > 0) {
                self.service.allocator.free(tokens.refresh_token);
            }
        }

        // 요청 본문 확인
        const body = r.body orelse {
            return self.sendError(r, 400, "MISSING_BODY", "Missing request body");
        };

        // Google Sheets API 호출
        const response_json = self.service.writeSpreadsheetValues(tokens.access_token, body) catch {
            return self.sendError(r, 500, "WRITE_FAILED", "Failed to write spreadsheet data");
        };
        defer self.service.allocator.free(response_json);

        try self.sendJson(r, 200, response_json);
    }

    const TokenPair = struct {
        access_token: []u8,
        refresh_token: []u8,
    };

    // 헬퍼 메서드들
    fn getTokensFromJwt(self: *SheetsController, r: zap.Request) !TokenPair {
        r.parseCookies(false);
        const jwt_cookie = r.getCookieStr(self.service.allocator, "jwt") catch {
            return error.NoToken;
        };

        const payload = jwt.verifyJwt(self.service.allocator, jwt_cookie.?, globals.jwt_secret) catch |err| {
            return err;
        };
        defer self.service.allocator.free(payload);

        const access_token = self.extractJsonString(payload, "\"access_token\":\"") orelse {
            return error.NoAccessToken;
        };

        const refresh_token = self.extractJsonString(payload, "\"refresh_token\":\"") orelse "";

        return TokenPair{
            .access_token = try self.service.allocator.dupe(u8, access_token),
            .refresh_token = if (refresh_token.len > 0) try self.service.allocator.dupe(u8, refresh_token) else "",
        };
    }

    fn getQueryParam(_: *SheetsController, r: zap.Request, param: []const u8) ![]const u8 {
        const query = r.query orelse return error.MissingQuery;
        var params = QueryIterator.init(query);
        while (params.next()) |p| {
            if (std.mem.eql(u8, p.key, param)) return p.value;
        }
        return error.ParamNotFound;
    }

    fn handleAuthError(self: *SheetsController, r: zap.Request, err: anyerror) !void {
        switch (err) {
            error.TokenExpired => try self.sendError(r, 401, "TOKEN_EXPIRED", "Token expired"),
            error.InvalidSignature => try self.sendError(r, 401, "INVALID_TOKEN", "Invalid token"),
            error.NoToken => try self.sendError(r, 401, "NO_TOKEN", "Not logged in"),
            error.NoAccessToken => try self.sendError(r, 401, "NO_ACCESS_TOKEN", "No access token in JWT"),
            else => try self.sendError(r, 401, "AUTH_FAILED", "Authentication failed"),
        }
    }

    fn sendJson(_: *SheetsController, r: zap.Request, status: u16, json: []const u8) !void {
        r.setStatusNumeric(status);
        try r.setHeader("Content-Type", "application/json; charset=utf-8");
        try r.sendBody(json);
    }

    fn sendError(self: *SheetsController, r: zap.Request, status: u16, code: []const u8, message: []const u8) !void {
        try error_handler.sendErrorJson(self.service.allocator, r, status, code, message);
    }

    fn extractJsonString(_: *SheetsController, json: []const u8, key: []const u8) ?[]const u8 {
        if (std.mem.indexOf(u8, json, key)) |start| {
            const val_start = start + key.len;
            if (val_start >= json.len) return null;
            var val_end = val_start;
            while (val_end < json.len and json[val_end] != '"') : (val_end += 1) {}
            return json[val_start..val_end];
        }
        return null;
    }
};
