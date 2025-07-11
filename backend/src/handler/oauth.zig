const std = @import("std");
const zap = @import("zap");
const http = std.http;
const Env = @import("../env.zig").Env;
const QueryIterator = @import("../util/query.zig").QueryIterator;
const SendErrorJson = @import("error.zig").sendErrorJson;
const rand = std.crypto.random;
const SessionManager = @import("../util/session.zig").SessionManager;

pub const OAuthHandler = struct {
    allocator: std.mem.Allocator,
    env: Env,
    client_id: []const u8,
    redirect_uri: []const u8,
    scope: []const u8 = "openid email profile",

    pub fn init(allocator: std.mem.Allocator, env: Env) !OAuthHandler {
        return .{
            .allocator = allocator,
            .env = env,
            .client_id = env.get("GOOGLE_CLIENT_ID") orelse return error.MissingGoogleClientId,
            .redirect_uri = env.get("GOOGLE_REDIRECT_URI") orelse return error.MissingRedirectUri,
        };
    }

    pub fn deinit(_: *OAuthHandler) void {}

    /// 1. 구글 인증 시작: 인증 URL을 JSON으로 반환
    pub fn handleGoogleAuth(self: *OAuthHandler, r: zap.Request) !void {
        var state_bytes: [32]u8 = undefined;
        rand.bytes(&state_bytes);
        const state = try std.fmt.allocPrint(self.allocator, "{}", .{std.fmt.fmtSliceHexLower(&state_bytes)});
        defer self.allocator.free(state);

        const url = try self.buildGoogleAuthUrl(state);
        defer self.allocator.free(url);

        try self.setSessionCookie(r, "oauth_state", state);

        // JSON으로 인증 URL 반환
        const json_response = try std.fmt.allocPrint(self.allocator, "{{\"auth_url\":\"{s}\"}}", .{url});
        defer self.allocator.free(json_response);

        r.setStatusNumeric(200);
        try r.setHeader("Content-Type", "application/json; charset=utf-8");
        try r.sendBody(json_response);
    }

    /// 2. 구글 콜백: 세션 생성, user_info JSON 반환, 세션 쿠키 발급
    pub fn handleGoogleCallback(self: *OAuthHandler, r: zap.Request, session_mgr: *SessionManager) !void {
        r.parseCookies(false);

        const code = try self.getQueryParam(r, "code");
        const state = try self.getQueryParam(r, "state");

        const saved_state = self.getSessionCookie(r, "oauth_state") orelse {
            return SendErrorJson(self.allocator, r, 401, "Invalid session: no state cookie");
        };

        if (!std.mem.eql(u8, state, saved_state)) {
            return SendErrorJson(self.allocator, r, 401, "State mismatch");
        }

        const client_secret = self.env.get("GOOGLE_CLIENT_SECRET") orelse {
            return SendErrorJson(self.allocator, r, 500, "Server configuration error.");
        };

        const token_response = try self.exchangeGoogleCode(code, client_secret);
        defer self.allocator.free(token_response);

        const access_token = self.parseAccessToken(token_response) catch {
            return SendErrorJson(self.allocator, r, 500, "Failed to parse access token");
        };
        defer self.allocator.free(access_token);

        const user_info = self.getGoogleUserInfo(access_token) catch {
            return SendErrorJson(self.allocator, r, 500, "Failed to get user info");
        };
        defer self.allocator.free(user_info);

        // 세션 생성 및 쿠키 발급
        const session_id = try session_mgr.createSession(user_info);

        try r.setCookie(.{
            .name = "session",
            .value = session_id,
            .http_only = true,
            .path = "/",
            .max_age_s = 60 * 60 * 24,
        });

        // JSON 응답
        r.setStatusNumeric(200);
        try r.setHeader("Content-Type", "application/json; charset=utf-8");
        try r.sendBody(user_info);
    }

    /// 3. 로그인 상태 확인
    pub fn handleMe(self: *OAuthHandler, r: zap.Request, session_mgr: *SessionManager) !void {
        r.parseCookies(false);
        const session_id = r.getCookieStr(self.allocator, "session") catch null;
        if (session_id) |sid| {
            if (session_mgr.getUserInfo(sid)) |user_info| {
                r.setStatusNumeric(200);
                try r.setHeader("Content-Type", "application/json; charset=utf-8");
                try r.sendBody(user_info);
                return;
            }
        }
        r.setStatusNumeric(401);
        try r.sendBody("{\"error\":true,\"message\":\"Not logged in\"}");
    }

    /// 4. 로그아웃
    pub fn handleLogout(self: *OAuthHandler, r: zap.Request, session_mgr: *SessionManager) !void {
        r.parseCookies(false);
        const session_id = r.getCookieStr(self.allocator, "session") catch null;
        if (session_id) |sid| {
            session_mgr.destroySession(sid);
        }
        // 세션 쿠키 만료
        try r.setCookie(.{
            .name = "session",
            .value = "",
            .http_only = true,
            .path = "/",
            .max_age_s = 0,
        });
        r.setStatusNumeric(200);
        try r.sendBody("{\"success\":true}");
    }

    fn exchangeGoogleCode(self: *OAuthHandler, code: []const u8, client_secret: []const u8) ![]u8 {
        var client: http.Client = .{ .allocator = self.allocator };
        defer client.deinit();

        const body = try std.fmt.allocPrint(
            self.allocator,
            "code={s}&client_id={s}&client_secret={s}&redirect_uri={s}&grant_type=authorization_code",
            .{ code, self.client_id, client_secret, self.redirect_uri },
        );
        defer self.allocator.free(body);

        const uri = try std.Uri.parse("https://oauth2.googleapis.com/token");
        var server_header_buffer: [16 * 1024]u8 = undefined;

        const content_type_header = http.Header{
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

    fn getGoogleUserInfo(self: *OAuthHandler, access_token: []const u8) ![]u8 {
        var client: http.Client = .{ .allocator = self.allocator };
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

    fn parseAccessToken(self: *OAuthHandler, json_response: []const u8) ![]u8 {
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

    fn buildGoogleAuthUrl(self: *OAuthHandler, state: []const u8) ![]u8 {
        return std.fmt.allocPrint(
            self.allocator,
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={s}&redirect_uri={s}&response_type=code&scope={s}&state={s}&access_type=offline&prompt=select_account",
            .{ self.client_id, self.redirect_uri, self.scope, state },
        );
    }

    fn getQueryParam(_: *OAuthHandler, r: zap.Request, param: []const u8) ![]const u8 {
        const query = r.query orelse return error.MissingQuery;
        var params = QueryIterator.init(query);
        while (params.next()) |p| {
            if (std.mem.eql(u8, p.key, param)) return p.value;
        }
        return error.ParamNotFound;
    }

    fn setSessionCookie(_: *OAuthHandler, r: zap.Request, key: []const u8, value: []const u8) !void {
        try r.setCookie(.{
            .name = key,
            .value = value,
            .http_only = false,
            .path = "/",
            .max_age_s = 300,
        });
    }

    fn getSessionCookie(self: *OAuthHandler, r: zap.Request, key: []const u8) ?[]const u8 {
        const cookie_value = r.getCookieStr(self.allocator, key) catch {
            return null;
        };
        return cookie_value;
    }
};
