const std = @import("std");
const zap = @import("zap");
const OAuthService = @import("../service/oauth_service.zig").OAuthService;
const sendErrorJson = @import("../handler/error_handler.zig").sendErrorJson;
const constants = @import("../config/constants.zig");
const User = @import("../model/user.zig").User;
const jwt_util = @import("../util/jwt.zig");

pub const OAuthController = struct {
    oauth_service: *OAuthService,
    jwt_secret: []const u8,

    pub fn init(oauth_service: *OAuthService, jwt_secret: []const u8) OAuthController {
        return .{
            .oauth_service = oauth_service,
            .jwt_secret = jwt_secret,
        };
    }

    pub fn googleAuth(self: *OAuthController, r: zap.Request) !void {
        const state = try self.oauth_service.generateState();
        defer self.oauth_service.allocator.free(state);

        const url = try self.oauth_service.buildGoogleAuthUrl(state);
        defer self.oauth_service.allocator.free(url);

        try self.oauth_service.setSessionCookie(r, constants.OAUTH_STATE_COOKIE_NAME, state);

        const json_response = try std.fmt.allocPrint(self.oauth_service.allocator, "{{\"auth_url\":\"{s}\"}}", .{url});
        defer self.oauth_service.allocator.free(json_response);

        r.setStatusNumeric(200);
        try r.setHeader("Content-Type", "application/json; charset=utf-8");
        try r.sendBody(json_response);
    }

    pub fn googleCallback(self: *OAuthController, r: zap.Request) !void {
        r.parseCookies(false);

        const code = try self.oauth_service.getQueryParam(r, "code");
        const state = try self.oauth_service.getQueryParam(r, "state");

        const saved_state = self.oauth_service.getSessionCookie(r, constants.OAUTH_STATE_COOKIE_NAME) orelse {
            return sendErrorJson(self.oauth_service.allocator, r, 401, "Invalid session: no state cookie");
        };

        if (!std.mem.eql(u8, state, saved_state)) {
            return sendErrorJson(self.oauth_service.allocator, r, 401, "State mismatch");
        }

        const token_response = try self.oauth_service.exchangeGoogleCode(code);
        defer self.oauth_service.allocator.free(token_response);

        const access_token = self.oauth_service.parseAccessToken(token_response) catch {
            return sendErrorJson(self.oauth_service.allocator, r, 500, "Failed to parse access token");
        };
        defer self.oauth_service.allocator.free(access_token);

        const user_info_json = self.oauth_service.getGoogleUserInfo(access_token) catch {
            return sendErrorJson(self.oauth_service.allocator, r, 500, "Failed to get user info");
        };
        defer self.oauth_service.allocator.free(user_info_json);

        // 실제 서비스라면 user_info_json을 User 구조체로 파싱해야 함
        const user = User{
            .id = "google-id",
            .name = "Google User",
            .email = "user@example.com",
            .picture = null,
            .role = if (std.mem.eql(u8, "user@example.com", "admin@example.com")) "admin" else "user",
        };

        // JWT payload 생성
        const now = std.time.timestamp();
        const exp = now + 60 * 60 * 24;
        const payload = try std.fmt.allocPrint(self.oauth_service.allocator, "{{\"sub\":\"{s}\",\"name\":\"{s}\",\"email\":\"{s}\",\"role\":\"{s}\",\"exp\":{d}}}", .{ user.id, user.name, user.email, user.role, exp });
        defer self.oauth_service.allocator.free(payload);

        // JWT 생성
        const jwt = try jwt_util.createJwt(self.oauth_service.allocator, payload, self.jwt_secret);
        defer self.oauth_service.allocator.free(jwt);

        // JWT를 쿠키로 발급
        try r.setCookie(.{
            .name = "jwt",
            .value = jwt,
            .http_only = true,
            .path = "/",
            .max_age_s = 60 * 60 * 24,
            .secure = false, // 개발환경에서는 반드시 false!
        });

        // 팝업 닫기용 HTML
        const close_html =
            "<!DOCTYPE html><html><body><script>window.opener&&window.opener.postMessage({type:'LOGIN_SUCCESS'},'*');window.close();</script><p>로그인 성공! 창을 닫습니다...</p></body></html>";
        r.setStatusNumeric(200);
        try r.setHeader("Content-Type", "text/html; charset=utf-8");
        try r.sendBody(close_html);
    }

    pub fn me(self: *OAuthController, r: zap.Request) !void {
        r.parseCookies(false);
        const jwt = r.getCookieStr(self.oauth_service.allocator, "jwt") catch null;
        if (jwt) |token| {
            const payload = jwt_util.verifyJwt(self.oauth_service.allocator, token, self.jwt_secret) catch null;
            if (payload) |pl| {
                // 간단 JSON 파싱 (name, email, role)
                const name = extractJsonString(pl, "\"name\":\"") orelse "";
                const email = extractJsonString(pl, "\"email\":\"") orelse "";
                const role = extractJsonString(pl, "\"role\":\"") orelse "";
                const json_response = try std.fmt.allocPrint(self.oauth_service.allocator, "{{\"name\":\"{s}\",\"email\":\"{s}\",\"role\":\"{s}\"}}", .{ name, email, role });
                defer self.oauth_service.allocator.free(json_response);
                r.setStatusNumeric(200);
                try r.setHeader("Content-Type", "application/json; charset=utf-8");
                try r.sendBody(json_response);
                return;
            }
        }
        r.setStatusNumeric(401);
        try r.sendBody("{\"error\":true,\"message\":\"Not logged in\"}");
    }

    pub fn logout(_: *OAuthController, r: zap.Request) !void {
        try r.setCookie(.{
            .name = "jwt",
            .value = "",
            .http_only = true,
            .path = "/",
            .max_age_s = 0,
        });
        r.setStatusNumeric(200);
        try r.sendBody("{\"success\":true}");
    }
};

/// 매우 단순한 JSON 파서 (key: "value"만 추출)
fn extractJsonString(json: []const u8, key: []const u8) ?[]const u8 {
    if (std.mem.indexOf(u8, json, key)) |start| {
        const val_start = start + key.len;
        if (val_start >= json.len) return null;
        var val_end = val_start;
        while (val_end < json.len and json[val_end] != '"') : (val_end += 1) {}
        return json[val_start..val_end];
    }
    return null;
}
