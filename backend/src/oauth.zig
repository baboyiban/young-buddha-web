const std = @import("std");
const zap = @import("zap");
const http = std.http;
const Env = @import("env.zig").Env;
const rand = std.crypto.random;

pub const QueryIterator = struct {
    it: std.mem.SplitIterator(u8, .scalar),

    pub fn init(query: []const u8) QueryIterator {
        return .{ .it = std.mem.splitScalar(u8, query, '&') };
    }
    pub fn next(self: *QueryIterator) ?struct { key: []const u8, value: []const u8 } {
        while (self.it.next()) |pair| {
            if (std.mem.indexOfScalar(u8, pair, '=')) |eq| {
                return .{
                    .key = pair[0..eq],
                    .value = pair[eq + 1 ..],
                };
            }
        }
        return null;
    }
};

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

    pub fn handleGoogleAuth(self: *OAuthHandler, r: zap.Request) !void {
        var state_bytes: [32]u8 = undefined;
        rand.bytes(&state_bytes);
        const state = try std.fmt.allocPrint(self.allocator, "{}", .{std.fmt.fmtSliceHexLower(&state_bytes)});
        defer self.allocator.free(state);

        const url = try self.buildGoogleAuthUrl(state);
        defer self.allocator.free(url);

        try self.setSessionCookie(r, "oauth_state", state);
        return self.sendRedirect(r, url);
    }

    fn sendSuccessResponse(self: *OAuthHandler, r: zap.Request, user_info: []const u8) !void {
        const html_response = try std.fmt.allocPrint(self.allocator, "<html><body><h1>로그인 성공!</h1><h2>사용자 정보:</h2><pre>{s}</pre><script>window.close();</script></body></html>", .{user_info});
        defer self.allocator.free(html_response);

        r.setStatusNumeric(200);
        try r.setHeader("Content-Type", "text/html; charset=utf-8");
        try r.sendBody(html_response);
    }

    fn parseAccessToken(self: *OAuthHandler, json_response: []const u8) ![]u8 {
        // 간단한 JSON 파싱 (실제로는 std.json을 사용하는 것이 좋음)
        const access_token_start = std.mem.indexOf(u8, json_response, "\"access_token\":\"") orelse return error.InvalidTokenResponse;
        const start_pos = access_token_start + "\"access_token\":\"".len;
        const access_token_end = std.mem.indexOfScalarPos(u8, json_response, start_pos, '"') orelse return error.InvalidTokenResponse;

        const access_token = json_response[start_pos..access_token_end];
        return try self.allocator.dupe(u8, access_token);
    }

    pub fn handleGoogleCallback(self: *OAuthHandler, r: zap.Request) !void {
        r.parseCookies(false);

        const code = try self.getQueryParam(r, "code");
        const state = try self.getQueryParam(r, "state");

        std.log.info("Callback received - state: {s}, code: {s}", .{ state, code });

        const saved_state = self.getSessionCookie(r, "oauth_state") orelse {
            std.log.err("No state cookie found!", .{});
            return self.sendError(r, 401, "Invalid session: no state cookie");
        };

        std.log.info("Comparing states - received: {s}, saved: {s}", .{ state, saved_state });

        if (!std.mem.eql(u8, state, saved_state)) {
            return self.sendError(r, 401, "State mismatch");
        }

        const client_secret = self.env.get("GOOGLE_CLIENT_SECRET") orelse {
            std.log.err("GOOGLE_CLIENT_SECRET not found in environment.", .{});
            return self.sendError(r, 500, "Server configuration error.");
        };

        const token_response = try self.exchangeGoogleCode(code, client_secret);
        defer self.allocator.free(token_response);

        // JSON 파싱하여 access_token 추출
        const access_token = try self.parseAccessToken(token_response);
        defer self.allocator.free(access_token);

        // 사용자 정보 가져오기
        const user_info = try self.getGoogleUserInfo(access_token);
        defer self.allocator.free(user_info);

        // 성공 페이지로 리디렉션 또는 사용자 정보 표시
        try self.sendSuccessResponse(r, user_info);
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

        std.log.info("Sending request to Google OAuth API", .{});
        std.log.info("Request body: {s}", .{body});

        const uri = try std.Uri.parse("https://oauth2.googleapis.com/token");

        var server_header_buffer: [16 * 1024]u8 = undefined;

        // Content-Type 헤더를 extra_headers로 설정
        const content_type_header = http.Header{
            .name = "Content-Type",
            .value = "application/x-www-form-urlencoded",
        };

        var req = try client.open(.POST, uri, .{
            .server_header_buffer = &server_header_buffer,
            .extra_headers = &.{content_type_header},
        });
        defer req.deinit();

        // transfer_encoding 설정
        req.transfer_encoding = .{ .content_length = body.len };

        // 헤더와 함께 요청 전송
        try req.send();

        // 본문 전송
        try req.writeAll(body);
        try req.finish();
        try req.wait();

        const response = try req.reader().readAllAlloc(self.allocator, 10 * 1024);
        std.log.info("Google OAuth API response: {s}", .{response});

        return response;
    }

    fn getGoogleUserInfo(self: *OAuthHandler, access_token: []const u8) ![]u8 {
        var client: http.Client = .{ .allocator = self.allocator };
        defer client.deinit();

        const url = try std.fmt.allocPrint(self.allocator, "https://www.googleapis.com/oauth2/v1/userinfo?access_token={s}", .{access_token});
        defer self.allocator.free(url);

        std.log.info("Getting user info from Google API", .{});

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
        std.log.info("Google User Info response: {s}", .{response});

        return response;
    }

    fn buildGoogleAuthUrl(self: *OAuthHandler, state: []const u8) ![]u8 {
        return std.fmt.allocPrint(
            self.allocator,
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={s}&redirect_uri={s}&response_type=code&scope={s}&state={s}&access_type=offline",
            .{ self.client_id, self.redirect_uri, self.scope, state },
        );
    }

    fn sendRedirect(_: *OAuthHandler, r: zap.Request, url: []const u8) !void {
        r.setStatusNumeric(302);
        try r.setHeader("Location", url);
        try r.sendBody("");
    }

    fn sendError(self: *OAuthHandler, r: zap.Request, status: usize, message: []const u8) !void {
        // JSON 문자열을 직접 만들어서 전송
        const json_response = try std.fmt.allocPrint(self.allocator, "{{\"error\":\"error\",\"message\":\"{s}\"}}", .{message});
        defer self.allocator.free(json_response);

        r.setStatusNumeric(status);
        try r.sendJson(json_response);
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
        // 디버깅을 위해 로그 추가
        const cookie_value = r.getCookieStr(self.allocator, key) catch |err| {
            std.log.err("Failed to get cookie '{s}': {any}", .{ key, err });
            return null;
        };

        if (cookie_value) |value| {
            std.log.info("Cookie '{s}' found: {s}", .{ key, value });
            return value;
        } else {
            std.log.warn("Cookie '{s}' not found", .{key});
            return null;
        }
    }
};
