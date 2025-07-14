const std = @import("std");
const zap = @import("zap");
const OAuthService = @import("../service/oauth_service.zig").OAuthService;
const SessionService = @import("../service/session_service.zig").SessionService;
const sendErrorJson = @import("../handler/error_handler.zig").sendErrorJson;
const constants = @import("../config/constants.zig");
const User = @import("../model/user.zig").User;

pub const OAuthController = struct {
    oauth_service: *OAuthService,
    session_service: *SessionService,

    pub fn init(oauth_service: *OAuthService, session_service: *SessionService) OAuthController {
        return .{
            .oauth_service = oauth_service,
            .session_service = session_service,
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
            .id = "google-id", // 실제로는 user_info_json에서 추출
            .name = "Google User",
            .email = "user@example.com",
            .picture = null,
        };

        // 세션 생성 및 쿠키 발급
        const session_id = try self.session_service.createSession(user);

        try r.setCookie(.{
            .name = constants.SESSION_COOKIE_NAME,
            .value = session_id,
            .http_only = true,
            .path = "/",
            .max_age_s = 60 * 60 * 24,
        });

        // 팝업 닫기용 HTML (예외적으로 HTML 반환)
        const close_html =
            "<!DOCTYPE html><html><body><script>window.opener&&window.opener.postMessage({type:'LOGIN_SUCCESS'},'*');window.close();</script><p>로그인 성공! 창을 닫습니다...</p></body></html>";
        r.setStatusNumeric(200);
        try r.setHeader("Content-Type", "text/html; charset=utf-8");
        try r.sendBody(close_html);
    }

    pub fn me(self: *OAuthController, r: zap.Request) !void {
        r.parseCookies(false);
        const session_id = r.getCookieStr(self.oauth_service.allocator, constants.SESSION_COOKIE_NAME) catch null;
        if (session_id) |sid| {
            if (self.session_service.getUser(sid)) |user| {
                r.setStatusNumeric(200);
                try r.setHeader("Content-Type", "application/json; charset=utf-8");
                // 예시: user가 구조체라면 아래처럼 직렬화
                // 실제로는 zig의 json 직렬화 라이브러리를 사용하는 것이 좋음
                const json_response = try std.fmt.allocPrint(self.oauth_service.allocator, "{{\"name\":\"{s}\",\"email\":\"{s}\"}}", .{ user.name, user.email });
                defer self.oauth_service.allocator.free(json_response);
                try r.sendBody(json_response);
                return;
            }
        }
        r.setStatusNumeric(401);
        try r.sendBody("{\"error\":true,\"message\":\"Not logged in\"}");
    }

    pub fn logout(self: *OAuthController, r: zap.Request) !void {
        r.parseCookies(false);
        const session_id = r.getCookieStr(self.oauth_service.allocator, constants.SESSION_COOKIE_NAME) catch null;
        if (session_id) |sid| {
            self.session_service.destroySession(sid);
        }
        try r.setCookie(.{
            .name = constants.SESSION_COOKIE_NAME,
            .value = "",
            .http_only = true,
            .path = "/",
            .max_age_s = 0,
        });
        r.setStatusNumeric(200);
        try r.sendBody("{\"success\":true}");
    }
};
