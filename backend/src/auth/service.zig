const std = @import("std");
const zap = @import("zap");
const Env = @import("../config/env.zig").Env;
const User = @import("model/user.zig").User;
const constants = @import("../config/constants.zig");
const QueryIterator = @import("../util/query.zig").QueryIterator;
const Logger = @import("../util/logger.zig").Logger;
const HttpClient = @import("../util/http_client.zig").HttpClient;
const AuthError = @import("errors.zig").AuthError;
const rand = std.crypto.random;
const globals = @import("../config/globals.zig");

const logger = Logger.init("AuthService");

pub const TokenPair = struct {
    access_token: []u8,
    refresh_token: []u8,
};

pub const AuthService = struct {
    allocator: std.mem.Allocator,
    client_id: []const u8,
    client_secret: []const u8,
    redirect_uri: []const u8,
    scope: []const u8,
    http_client: HttpClient,

    pub fn init(allocator: std.mem.Allocator, env: *const Env) !AuthService {
        const client_id = env.get("GOOGLE_CLIENT_ID") orelse {
            logger.err("Google Client ID not found in environment variables", .{});
            return AuthError.MissingGoogleClientId;
        };

        const client_secret = env.get("GOOGLE_CLIENT_SECRET") orelse {
            logger.err("Google Client Secret not found in environment variables", .{});
            return AuthError.MissingGoogleClientSecret;
        };

        const redirect_uri = env.get("GOOGLE_REDIRECT_URI") orelse {
            logger.err("Google Redirect URI not found in environment variables", .{});
            return AuthError.MissingRedirectUri;
        };

        logger.info("AuthService initialized successfully", .{});

        return .{
            .allocator = allocator,
            .client_id = client_id,
            .client_secret = client_secret,
            .redirect_uri = redirect_uri,
            .scope = constants.GOOGLE_SCOPE,
            .http_client = HttpClient.init(allocator),
        };
    }

    pub fn deinit(self: *AuthService) void {
        self.http_client.deinit();
    }

    pub fn generateState(self: *AuthService) ![]u8 {
        var state_bytes: [32]u8 = undefined;
        rand.bytes(&state_bytes);
        return std.fmt.allocPrint(self.allocator, "{}", .{std.fmt.fmtSliceHexLower(&state_bytes)});
    }

    /// Google OAuth2 인증 URL을 생성합니다.
    pub fn buildGoogleAuthUrl(self: *AuthService, state: []const u8) ![]u8 {
        return std.fmt.allocPrint(
            self.allocator,
            "{s}?client_id={s}&redirect_uri={s}&response_type=code&scope={s}&state={s}&access_type=offline&prompt=consent",
            .{ constants.GOOGLE_AUTH_URL, self.client_id, self.redirect_uri, self.scope, state },
        );
    }

    /// 세션 쿠키를 설정합니다.
    pub fn setSessionCookie(_: *AuthService, r: zap.Request, key: []const u8, value: []const u8) !void {
        try r.setCookie(.{
            .name = key,
            .value = value,
            .http_only = false,
            .path = "/",
            .max_age_s = constants.OAUTH_STATE_EXPIRY_SECONDS,
        });
    }

    pub fn getSessionCookie(self: *AuthService, r: zap.Request, key: []const u8) ?[]const u8 {
        return r.getCookieStr(self.allocator, key) catch null;
    }

    pub fn getQueryParam(_: *AuthService, r: zap.Request, param: []const u8) ![]const u8 {
        const query = r.query orelse return error.MissingQuery;
        var params = QueryIterator.init(query);
        while (params.next()) |p| {
            if (std.mem.eql(u8, p.key, param)) return p.value;
        }
        return error.ParamNotFound;
    }

    /// Google OAuth2 인증 코드를 액세스 토큰으로 교환합니다.
    pub fn exchangeGoogleCode(self: *AuthService, code: []const u8) !TokenPair {
        var client: std.http.Client = .{ .allocator = self.allocator };
        defer client.deinit();

        const body = try std.fmt.allocPrint(
            self.allocator,
            "code={s}&client_id={s}&client_secret={s}&redirect_uri={s}&grant_type=authorization_code",
            .{ code, self.client_id, self.client_secret, self.redirect_uri },
        );
        defer self.allocator.free(body);

        const uri = std.Uri.parse(constants.GOOGLE_TOKEN_URL) catch |err| {
            std.log.err("Failed to parse OAuth token URL: {any}", .{err});
            return error.InvalidUrl;
        };

        var server_header_buffer: [16 * 1024]u8 = undefined;
        var req = client.open(.POST, uri, .{
            .server_header_buffer = &server_header_buffer,
            .extra_headers = &.{.{
                .name = "Content-Type",
                .value = "application/x-www-form-urlencoded",
            }},
        }) catch |err| {
            std.log.err("Failed to open HTTP request: {any}", .{err});
            return error.HttpRequestFailed;
        };
        defer req.deinit();

        req.transfer_encoding = .{ .content_length = body.len };
        req.send() catch |err| {
            std.log.err("Failed to send HTTP request: {any}", .{err});
            return error.HttpRequestFailed;
        };
        req.writeAll(body) catch |err| {
            std.log.err("Failed to write request body: {any}", .{err});
            return error.HttpRequestFailed;
        };
        req.finish() catch |err| {
            std.log.err("Failed to finish HTTP request: {any}", .{err});
            return error.HttpRequestFailed;
        };
        req.wait() catch |err| {
            std.log.err("Failed to wait for HTTP response: {any}", .{err});
            return error.HttpRequestFailed;
        };

        const response = req.reader().readAllAlloc(self.allocator, 10 * 1024) catch |err| {
            std.log.err("Failed to read HTTP response: {any}", .{err});
            return error.HttpResponseFailed;
        };
        defer self.allocator.free(response);

        // DEBUG: 구글 토큰 요청 파라미터 로그
        logger.info("[DEBUG] Google OAuth token request params:", .{});
        logger.info("  code: {s}", .{code});
        logger.info("  client_id: {s}", .{self.client_id});
        logger.info("  client_secret: {s}", .{self.client_secret});
        logger.info("  redirect_uri: {s}", .{self.redirect_uri});
        logger.info("  body: {s}", .{body});
        // 응답 상태 코드 확인
        logger.info("[DEBUG] Google OAuth token response status: {any}", .{req.response.status});
        logger.info("[DEBUG] Google OAuth token response body: {s}", .{response});
        if (req.response.status != .ok) {
            std.log.err("OAuth token exchange failed with status: {any}", .{req.response.status});
            std.log.err("Response body: {s}", .{response});
            return error.OAuthTokenExchangeFailed;
        }

        const access_token = self.parseJsonString(response, "access_token") catch |err| {
            std.log.err("Failed to parse access_token from response: {any}", .{err});
            return error.InvalidTokenResponse;
        };

        const refresh_token = self.parseJsonString(response, "refresh_token") catch "";

        return TokenPair{
            .access_token = access_token,
            .refresh_token = if (refresh_token.len > 0) try self.allocator.dupe(u8, refresh_token) else "",
        };
    }

    pub fn getGoogleUserInfo(self: *AuthService, access_token: []const u8) !User {
        var client: std.http.Client = .{ .allocator = self.allocator };
        defer client.deinit();

        const url = try std.fmt.allocPrint(
            self.allocator,
            "{s}?access_token={s}",
            .{ constants.GOOGLE_USERINFO_URL, access_token },
        );
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
        defer self.allocator.free(response);

        // 사용자 정보 파싱
        const id = self.parseJsonString(response, "id") catch "unknown";
        const name = self.parseJsonString(response, "name") catch "Unknown User";
        const email = self.parseJsonString(response, "email") catch "";

        // 관리자 이메일 체크 (환경변수에서 가져올 수도 있음)
        const role = if (std.mem.eql(u8, email, "admin@example.com")) "admin" else "user";

        return User{
            .id = id,
            .name = name,
            .email = email,
            .picture = null,
            .role = role,
        };
    }

    pub fn refreshAccessToken(self: *AuthService, refresh_token: []const u8) ![]u8 {
        var client: std.http.Client = .{ .allocator = self.allocator };
        defer client.deinit();

        const body = try std.fmt.allocPrint(
            self.allocator,
            "refresh_token={s}&client_id={s}&client_secret={s}&grant_type=refresh_token",
            .{ refresh_token, self.client_id, self.client_secret },
        );
        defer self.allocator.free(body);

        const uri = try std.Uri.parse(constants.GOOGLE_TOKEN_URL);
        var server_header_buffer: [16 * 1024]u8 = undefined;

        var req = try client.open(.POST, uri, .{
            .server_header_buffer = &server_header_buffer,
            .extra_headers = &.{.{
                .name = "Content-Type",
                .value = "application/x-www-form-urlencoded",
            }},
        });
        defer req.deinit();

        req.transfer_encoding = .{ .content_length = body.len };
        try req.send();
        try req.writeAll(body);
        try req.finish();
        try req.wait();

        const response = try req.reader().readAllAlloc(self.allocator, 10 * 1024);
        defer self.allocator.free(response);

        return try self.parseJsonString(response, "access_token");
    }

    fn parseJsonString(self: *AuthService, json: []const u8, key: []const u8) ![]u8 {
        const search_pattern = try std.fmt.allocPrint(self.allocator, "\"{s}\"", .{key});
        defer self.allocator.free(search_pattern);

        const start_marker = std.mem.indexOf(u8, json, search_pattern) orelse {
            return error.KeyNotFound;
        };

        const colon_pos = std.mem.indexOfScalarPos(u8, json, start_marker, ':') orelse {
            return error.InvalidFormat;
        };

        const quote_start = std.mem.indexOfScalarPos(u8, json, colon_pos, '"') orelse {
            return error.InvalidFormat;
        };

        const start_pos = quote_start + 1;
        const end_pos = std.mem.indexOfScalarPos(u8, json, start_pos, '"') orelse {
            return error.InvalidFormat;
        };

        const value = json[start_pos..end_pos];
        return try self.allocator.dupe(u8, value);
    }
};
