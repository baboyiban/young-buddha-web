const std = @import("std");
const zap = @import("zap");
const Service = @import("service.zig").SheetsService;
const auth = @import("../auth/middleware.zig");
const jwt = @import("../util/jwt.zig");
const globals = @import("../config/globals.zig");
const QueryIterator = @import("../util/query.zig").QueryIterator;
const error_handler = @import("../handler/error_handler.zig");
const json_util = @import("../util/json.zig");
const errors = @import("../config/errors.zig").Errors;

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
        const range = self.getQueryParam(r, "range") catch {
            return self.sendError(r, 400, "MISSING_RANGE", errors.MissingRange);
        };

        const values_json = self.service.getSpreadsheetValues(tokens.access_token, tokens.refresh_token, spreadsheet_id, range) catch {
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

        const response_json = self.service.writeSpreadsheetValues(tokens.access_token, body) catch {
            return self.sendError(r, 500, "WRITE_FAILED", "Failed to write spreadsheet data");
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
