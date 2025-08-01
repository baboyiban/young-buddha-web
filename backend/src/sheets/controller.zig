const std = @import("std");
const zap = @import("zap");
const Service = @import("service.zig").SheetsService;
const QueryRequest = @import("model.zig").QueryRequest;
const auth = @import("../auth/middleware.zig");
const jwt = @import("../util/jwt.zig");
const globals = @import("../config/globals.zig");
const QueryIterator = @import("../util/query.zig").QueryIterator;
const error_handler = @import("../error/error_handler.zig");
const json_util = @import("../util/json.zig");
const errors = @import("../error/errors.zig").Errors;

pub const SheetsController = struct {
    service: *Service,

    pub fn init(service: *Service) SheetsController {
        return .{ .service = service };
    }

    pub fn readSheet(self: *SheetsController, r: zap.Request) !void {
        const tokens = self.getTokensFromJwt(r) catch |err| {
            return self.handleAuthError(r, err);
        };
        // free는 controller에서만!
        defer self.service.allocator.free(tokens.access_token);
        defer self.service.allocator.free(tokens.refresh_token);

        const spreadsheet_id = self.getQueryParam(r, "spreadsheet_id") catch {
            return self.sendError(r, 400, "MISSING_SPREADSHEET_ID", errors.MissingSpreadsheetId);
        };
        const encoded_range = self.getQueryParam(r, "range") catch {
            return self.sendError(r, 400, "MISSING_RANGE", errors.MissingRange);
        };

        // URL 디코딩
        const range = self.service.urlDecode(encoded_range) catch {
            return self.sendError(r, 400, "INVALID_RANGE", "Invalid range format");
        };
        defer self.service.allocator.free(range);

        const values_json = self.service.getSpreadsheetValues(tokens.access_token, tokens.refresh_token, spreadsheet_id, range) catch |err| {
            std.log.err("Failed to get spreadsheet values: {any}", .{err});
            return self.sendError(r, 500, "READ_FAILED", errors.ReadFailed);
        };
        defer self.service.allocator.free(values_json);

        try self.sendJson(r, 200, values_json);
    }

    pub fn writeSheet(self: *SheetsController, r: zap.Request) !void {
        const tokens = self.getTokensFromJwt(r) catch |err| {
            return self.handleAuthError(r, err);
        };
        defer self.service.allocator.free(tokens.access_token);
        defer self.service.allocator.free(tokens.refresh_token);

        const body = r.body orelse {
            return self.sendError(r, 400, "MISSING_BODY", "Missing request body");
        };

        const spreadsheet_id = self.getQueryParam(r, "spreadsheet_id") catch {
            return self.sendError(r, 400, "MISSING_SPREADSHEET_ID", "Missing spreadsheet_id parameter");
        };
        const range = self.getQueryParam(r, "range") catch {
            return self.sendError(r, 400, "MISSING_RANGE", "Missing range parameter");
        };

        const response_json = self.service.writeSpreadsheetValues(tokens.access_token, tokens.refresh_token, spreadsheet_id, range, body) catch {
            return self.sendError(r, 500, "WRITE_FAILED", "Failed to write spreadsheet data");
        };
        defer self.service.allocator.free(response_json);

        try self.sendJson(r, 200, response_json);
    }

    /// Google Visualization API Query Language를 사용한 쿼리 실행 (POST)
    /// JSON 예시:
    /// {
    ///   "spreadsheet_id": "1r8_mfnZAvTFmT02JHi1XgOwn_-sLCR9XgmR8wEQ4uW4",
    ///   "query": "select A, sum(B) group by A",
    ///   "gid": "0",           // 선택적: 시트 ID
    ///   "range": "A1:C100"    // 선택적: 범위
    /// }
    pub fn querySheet(self: *SheetsController, r: zap.Request) !void {
        const tokens = self.getTokensFromJwt(r) catch |err| {
            return self.handleAuthError(r, err);
        };
        defer self.service.allocator.free(tokens.access_token);
        defer self.service.allocator.free(tokens.refresh_token);

        const body = r.body orelse {
            return self.sendError(r, 400, "MISSING_BODY", "Missing request body");
        };

        var parsed = std.json.parseFromSlice(std.json.Value, self.service.allocator, body, .{}) catch {
            return self.sendError(r, 400, "INVALID_JSON", "Invalid JSON format");
        };
        defer parsed.deinit();

        const obj = parsed.value.object;

        const spreadsheet_id = if (obj.get("spreadsheet_id")) |v|
            if (v == .string) v.string else return self.sendError(r, 400, "INVALID_SPREADSHEET_ID", "spreadsheet_id must be a string")
        else
            return self.sendError(r, 400, "MISSING_SPREADSHEET_ID", "Missing spreadsheet_id field");

        const query = if (obj.get("query")) |v|
            if (v == .string) v.string else return self.sendError(r, 400, "INVALID_QUERY", "query must be a string")
        else
            return self.sendError(r, 400, "MISSING_QUERY", "Missing query field");

        // 선택적 파라미터들
        const gid = if (obj.get("gid")) |v|
            if (v == .string) v.string else null
        else
            null;

        const range = if (obj.get("range")) |v|
            if (v == .string) v.string else null
        else
            null;

        const response_json = self.service.callSheetsQueryApiWithParams(
            tokens.access_token,
            spreadsheet_id,
            query,
            gid,
            range,
        ) catch |err| {
            std.log.err("Failed to execute query: {any}", .{err});
            return self.sendError(r, 500, "QUERY_FAILED", "Failed to execute query");
        };
        defer self.service.allocator.free(response_json);

        try self.sendJson(r, 200, response_json);
    }

    /// Google Visualization API Query Language를 사용한 쿼리 실행 (GET)
    /// URL 예시:
    /// - 기본: /api/sheets/query?spreadsheet_id=1r8_mfnZAvTFmT02JHi1XgOwn_-sLCR9XgmR8wEQ4uW4&tq=select%20A%2C%20sum(B)%20group%20by%20A
    /// - 시트 지정: /api/sheets/query?spreadsheet_id=1r8_mfnZAvTFmT02JHi1XgOwn_-sLCR9XgmR8wEQ4uW4&gid=0&tq=select%20A%2C%20sum(B)%20group%20by%20A
    /// - 범위 지정: /api/sheets/query?spreadsheet_id=1r8_mfnZAvTFmT02JHi1XgOwn_-sLCR9XgmR8wEQ4uW4&range=A1:C100&tq=select%20A%2C%20sum(B)%20group%20by%20A
    pub fn querySheetGet(self: *SheetsController, r: zap.Request) !void {
        const tokens = self.getTokensFromJwt(r) catch |err| {
            return self.handleAuthError(r, err);
        };
        defer self.service.allocator.free(tokens.access_token);
        defer self.service.allocator.free(tokens.refresh_token);

        const spreadsheet_id = self.getQueryParam(r, "spreadsheet_id") catch {
            return self.sendError(r, 400, "MISSING_SPREADSHEET_ID", "Missing spreadsheet_id parameter");
        };

        const encoded_query = self.getQueryParam(r, "tq") catch {
            return self.sendError(r, 400, "MISSING_QUERY", "Missing tq (query) parameter");
        };

        // 선택적 파라미터들
        const gid = self.getQueryParam(r, "gid") catch null;
        const encoded_range = self.getQueryParam(r, "range") catch null;

        // URL 디코딩
        const query = self.service.urlDecode(encoded_query) catch {
            return self.sendError(r, 400, "INVALID_QUERY", "Invalid query format");
        };
        defer self.service.allocator.free(query);

        var range: ?[]u8 = null;
        defer if (range) |r_val| self.service.allocator.free(r_val);

        if (encoded_range) |enc_range| {
            range = self.service.urlDecode(enc_range) catch {
                return self.sendError(r, 400, "INVALID_RANGE", "Invalid range format");
            };
        }

        const response_json = self.service.callSheetsQueryApiWithParams(
            tokens.access_token,
            spreadsheet_id,
            query,
            gid,
            range,
        ) catch |err| {
            std.log.err("Failed to execute query: {any}", .{err});
            return self.sendError(r, 500, "QUERY_FAILED", "Failed to execute query");
        };
        defer self.service.allocator.free(response_json);

        try self.sendJson(r, 200, response_json);
    }

    fn getTokensFromJwt(self: *SheetsController, r: zap.Request) !TokenPair {
        r.parseCookies(false);
        const jwt_cookie = r.getCookieStr(self.service.allocator, "jwt") catch {
            return error.NoToken;
        };
        defer if (jwt_cookie) |cookie| self.service.allocator.free(cookie);

        if (jwt_cookie == null) {
            return error.NoToken;
        }

        const payload = jwt.verifyJwt(self.service.allocator, jwt_cookie.?, globals.jwt_secret) catch |err| {
            return err;
        };
        defer self.service.allocator.free(payload);

        const access_token = try json_util.extractJsonString(self.service.allocator, payload, "access_token") orelse return error.NoAccessToken;
        const refresh_token = try json_util.extractJsonString(self.service.allocator, payload, "refresh_token") orelse try self.service.allocator.alloc(u8, 0);

        return TokenPair{
            .access_token = access_token,
            .refresh_token = refresh_token,
        };
    }

    const TokenPair = struct {
        access_token: []u8,
        refresh_token: []u8,
    };

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
};
