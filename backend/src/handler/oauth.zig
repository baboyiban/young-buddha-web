const std = @import("std");
const zap = @import("zap");
const http = std.http;
const Env = @import("../env.zig").Env;
const QueryIterator = @import("../util/query.zig").QueryIterator;
const sendError = @import("error.zig").sendError;
const rand = std.crypto.random;

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

    pub fn handleGoogleCallback(self: *OAuthHandler, r: zap.Request) !void {
        r.parseCookies(false);

        const code = try self.getQueryParam(r, "code");
        const state = try self.getQueryParam(r, "state");

        const saved_state = self.getSessionCookie(r, "oauth_state") orelse {
            return sendError(self.allocator, r, 401, "Invalid session: no state cookie");
        };

        if (!std.mem.eql(u8, state, saved_state)) {
            return sendError(self.allocator, r, 401, "State mismatch");
        }

        const client_secret = self.env.get("GOOGLE_CLIENT_SECRET") orelse {
            return sendError(self.allocator, r, 500, "Server configuration error.");
        };

        const token_response = try self.exchangeGoogleCode(code, client_secret);
        defer self.allocator.free(token_response);

        const access_token = self.parseAccessToken(token_response) catch {
            return sendError(self.allocator, r, 500, "Failed to parse access token");
        };
        defer self.allocator.free(access_token);

        const user_info = self.getGoogleUserInfo(access_token) catch {
            return sendError(self.allocator, r, 500, "Failed to get user info");
        };
        defer self.allocator.free(user_info);

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

    fn sendSuccessResponse(self: *OAuthHandler, r: zap.Request, user_info: []const u8) !void {
        const html_response = try std.fmt.allocPrint(self.allocator,
            \\<!DOCTYPE html>
            \\<html lang="ko">
            \\<head>
            \\  <meta charset="UTF-8">
            \\  <title>로그인 성공</title>
            \\  <style>
            \\    body {{ font-family: Arial, sans-serif; margin: 40px; background-color: #f5f5f5; }}
            \\    .container {{ max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
            \\    .success {{ color: #4CAF50; text-align: center; }}
            \\    .user-info {{ background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }}
            \\    .close-btn {{ background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; display: block; margin: 20px auto; }}
            \\    pre {{ background: #f4f4f4; padding: 10px; border-radius: 3px; overflow-x: auto; }}
            \\  </style>
            \\</head>
            \\<body>
            \\  <div class="container">
            \\    <h1 class="success">🎉 로그인 성공!</h1>
            \\    <div class="user-info">
            \\      <h3>사용자 정보:</h3>
            \\      <pre>{s}</pre>
            \\    </div>
            \\    <button class="close-btn" onclick="closeWindow()">창 닫기</button>
            \\  </div>
            \\  <script>
            \\    function closeWindow() {{
            \\      if (window.opener) {{
            \\        window.opener.postMessage({{type: 'LOGIN_SUCCESS', data: {s}}}, '*');
            \\      }}
            \\      window.close();
            \\    }}
            \\    setTimeout(closeWindow, 3000);
            \\  </script>
            \\</body>
            \\</html>
        , .{ user_info, user_info });
        defer self.allocator.free(html_response);

        r.setStatusNumeric(200);
        try r.setHeader("Content-Type", "text/html; charset=utf-8");
        try r.sendBody(html_response);
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
