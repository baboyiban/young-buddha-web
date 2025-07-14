const std = @import("std");
const zap = @import("zap");
const Env = @import("../config/env.zig").Env;
const constants = @import("../config/constants.zig");
const QueryIterator = @import("../util/query.zig").QueryIterator;
const rand = std.crypto.random;

pub const OAuthService = struct {
    allocator: std.mem.Allocator,
    env: Env,
    client_id: []const u8,
    client_secret: []const u8,
    redirect_uri: []const u8,
    scope: []const u8 = constants.GOOGLE_SCOPE,

    pub fn init(allocator: std.mem.Allocator, env: Env) !OAuthService {
        return .{
            .allocator = allocator,
            .env = env,
            .client_id = env.get("GOOGLE_CLIENT_ID") orelse return error.MissingGoogleClientId,
            .client_secret = env.get("GOOGLE_CLIENT_SECRET") orelse return error.MissingGoogleClientSecret,
            .redirect_uri = env.get("GOOGLE_REDIRECT_URI") orelse return error.MissingRedirectUri,
        };
    }

    pub fn generateState(self: *OAuthService) ![]u8 {
        var state_bytes: [32]u8 = undefined;
        rand.bytes(&state_bytes);
        return std.fmt.allocPrint(self.allocator, "{}", .{std.fmt.fmtSliceHexLower(&state_bytes)});
    }

    pub fn buildGoogleAuthUrl(self: *OAuthService, state: []const u8) ![]u8 {
        return std.fmt.allocPrint(
            self.allocator,
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={s}&redirect_uri={s}&response_type=code&scope={s}&state={s}&access_type=offline&prompt=select_account",
            .{ self.client_id, self.redirect_uri, self.scope, state },
        );
    }

    pub fn setSessionCookie(_: *OAuthService, r: zap.Request, key: []const u8, value: []const u8) !void {
        try r.setCookie(.{
            .name = key,
            .value = value,
            .http_only = false,
            .path = "/",
            .max_age_s = 300,
        });
    }

    pub fn getSessionCookie(self: *OAuthService, r: zap.Request, key: []const u8) ?[]const u8 {
        const cookie_value = r.getCookieStr(self.allocator, key) catch {
            return null;
        };
        return cookie_value;
    }

    pub fn getQueryParam(_: *OAuthService, r: zap.Request, param: []const u8) ![]const u8 {
        const query = r.query orelse return error.MissingQuery;
        var params = QueryIterator.init(query);
        while (params.next()) |p| {
            if (std.mem.eql(u8, p.key, param)) return p.value;
        }
        return error.ParamNotFound;
    }

    pub fn exchangeGoogleCode(self: *OAuthService, code: []const u8) ![]u8 {
        var client: std.http.Client = .{ .allocator = self.allocator };
        defer client.deinit();

        const body = try std.fmt.allocPrint(
            self.allocator,
            "code={s}&client_id={s}&client_secret={s}&redirect_uri={s}&grant_type=authorization_code",
            .{ code, self.client_id, self.client_secret, self.redirect_uri },
        );
        defer self.allocator.free(body);

        const uri = try std.Uri.parse("https://oauth2.googleapis.com/token");
        var server_header_buffer: [16 * 1024]u8 = undefined;

        const content_type_header = std.http.Header{
            .name = "Content-Type",
            .value = "application/x-www-form-urlencoded",
        };

        var req = try client.open(.POST, uri, .{
            .server_header_buffer = &server_header_buffer,
            .extra_headers = &.{content_type_header},
        });
        defer req.deinit();

        req.transfer_encoding = .{ .content_length = body.len };
        try req.send();
        try req.writeAll(body);
        try req.finish();
        try req.wait();

        const response = try req.reader().readAllAlloc(self.allocator, 10 * 1024);
        return response;
    }

    pub fn getGoogleUserInfo(self: *OAuthService, access_token: []const u8) ![]u8 {
        var client: std.http.Client = .{ .allocator = self.allocator };
        defer client.deinit();

        const url = try std.fmt.allocPrint(self.allocator, "https://www.googleapis.com/oauth2/v1/userinfo?access_token={s}", .{access_token});
        defer self.allocator.free(url);

        const uri = try std.Uri.parse(url);
        var server_header_buffer: [16 * 1024]u8 = undefined;

        var req = try client.open(.GET, uri, .{
            .server_header_buffer = &server_header_buffer,
        });
        defer req.deinit();

        try req.send();
        try req.finish();
        try req.wait();

        const response = try req.reader().readAllAlloc(self.allocator, 10 * 1024);
        return response;
    }

    // 매우 단순한 파싱, zig 공식 json 파서가 안정화되면 교체 권장
    pub fn parseAccessToken(self: *OAuthService, json_response: []const u8) ![]u8 {
        const search_pattern = "\"access_token\"";
        const start_marker = std.mem.indexOf(u8, json_response, search_pattern) orelse {
            return error.InvalidTokenResponse;
        };
        const colon_pos = std.mem.indexOfScalarPos(u8, json_response, start_marker, ':') orelse {
            return error.InvalidTokenResponse;
        };
        const quote_start = std.mem.indexOfScalarPos(u8, json_response, colon_pos, '"') orelse {
            return error.InvalidTokenResponse;
        };
        const start_pos = quote_start + 1;
        const end_pos = std.mem.indexOfScalarPos(u8, json_response, start_pos, '"') orelse {
            return error.InvalidTokenResponse;
        };
        const access_token = json_response[start_pos..end_pos];
        return try self.allocator.dupe(u8, access_token);
    }
};
