const std = @import("std");
const zap = @import("zap");
const Service = @import("service.zig").AuthService;
const User = @import("../model/user.zig").User;
const jwt = @import("../util/jwt.zig");
const globals = @import("../config/globals.zig");
const constants = @import("../config/constants.zig");

pub const AuthController = struct {
    service: *Service,

    pub fn init(service: *Service) AuthController {
        return .{ .service = service };
    }

    pub fn googleAuth(self: *AuthController, r: zap.Request) !void {
        const state = try self.service.generateState();
        defer self.service.allocator.free(state);

        const auth_url = try self.service.buildGoogleAuthUrl(state);
        defer self.service.allocator.free(auth_url);

        try self.service.setSessionCookie(r, constants.OAUTH_STATE_COOKIE_NAME, state);

        const response = try std.fmt.allocPrint(
            self.service.allocator,
            "{{\"auth_url\":\"{s}\"}}",
            .{auth_url},
        );
        defer self.service.allocator.free(response);

        try self.sendJson(r, 200, response);
    }

    pub fn googleCallback(self: *AuthController, r: zap.Request) !void {
        r.parseCookies(false);

        const code = self.service.getQueryParam(r, "code") catch {
            return self.sendError(r, 400, "Missing authorization code");
        };
        const state = self.service.getQueryParam(r, "state") catch {
            return self.sendError(r, 400, "Missing state parameter");
        };

        const saved_state = self.service.getSessionCookie(r, constants.OAUTH_STATE_COOKIE_NAME) orelse {
            return self.sendError(r, 401, "Invalid session: no state cookie");
        };

        if (!std.mem.eql(u8, state, saved_state)) {
            return self.sendError(r, 401, "State mismatch");
        }

        // Google에서 토큰 교환
        const tokens = self.service.exchangeGoogleCode(code) catch {
            return self.sendError(r, 500, "Failed to exchange authorization code");
        };
        defer self.service.allocator.free(tokens.access_token);
        defer if (tokens.refresh_token.len > 0) self.service.allocator.free(tokens.refresh_token);

        // 사용자 정보 가져오기
        const user = self.service.getGoogleUserInfo(tokens.access_token) catch {
            return self.sendError(r, 500, "Failed to get user info");
        };

        // JWT 생성 및 쿠키 설정
        const jwt_token = try self.createUserJwt(user, tokens);
        defer self.service.allocator.free(jwt_token);

        try r.setCookie(.{
            .name = "jwt",
            .value = jwt_token,
            .http_only = true,
            .path = "/",
            .max_age_s = 60 * 60 * 24, // 24시간
            .secure = globals.isProduction(),
        });

        // 팝업 닫기용 HTML
        const close_html =
            \\<!DOCTYPE html>
            \\<html>
            \\<body>
            \\<script>
            \\window.opener && window.opener.postMessage({type:'LOGIN_SUCCESS'},'*');
            \\window.close();
            \\</script>
            \\<p>로그인 성공! 창을 닫습니다...</p>
            \\</body>
            \\</html>
        ;

        r.setStatusNumeric(200);
        try r.setHeader("Content-Type", "text/html; charset=utf-8");
        try r.sendBody(close_html);
    }

    pub fn me(self: *AuthController, r: zap.Request) !void {
        r.parseCookies(false);
        const jwt_cookie = r.getCookieStr(self.service.allocator, "jwt") catch null;

        if (jwt_cookie) |token| {
            const payload = jwt.verifyJwt(self.service.allocator, token, globals.jwt_secret) catch |err| {
                const error_response = switch (err) {
                    error.TokenExpired => "{\"error\":true,\"message\":\"Token expired\",\"code\":\"TOKEN_EXPIRED\"}",
                    error.InvalidSignature => "{\"error\":true,\"message\":\"Invalid token\",\"code\":\"INVALID_TOKEN\"}",
                    else => "{\"error\":true,\"message\":\"Invalid token\",\"code\":\"INVALID_TOKEN\"}",
                };

                r.setStatusNumeric(401);
                try r.sendBody(error_response);
                return;
            };
            defer self.service.allocator.free(payload);

            // 사용자 정보 추출
            const name = self.extractJsonString(payload, "\"name\":\"") orelse "";
            const email = self.extractJsonString(payload, "\"email\":\"") orelse "";
            const role = self.extractJsonString(payload, "\"role\":\"") orelse "";

            const response = try std.fmt.allocPrint(
                self.service.allocator,
                "{{\"name\":\"{s}\",\"email\":\"{s}\",\"role\":\"{s}\"}}",
                .{ name, email, role },
            );
            defer self.service.allocator.free(response);

            try self.sendJson(r, 200, response);
            return;
        }

        // JWT 쿠키가 없는 경우
        r.setStatusNumeric(401);
        try r.sendBody("{\"error\":true,\"message\":\"Not logged in\",\"code\":\"NO_TOKEN\"}");
    }

    pub fn logout(_: *AuthController, r: zap.Request) !void {
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

    // 헬퍼 메서드들
    fn createUserJwt(self: *AuthController, user: User, tokens: @import("service.zig").TokenPair) ![]u8 {
        const now = std.time.timestamp();
        const exp = now + 60 * 60 * 24; // 24시간

        const payload = try std.fmt.allocPrint(
            self.service.allocator,
            "{{\"sub\":\"{s}\",\"name\":\"{s}\",\"email\":\"{s}\",\"role\":\"{s}\",\"exp\":{d},\"access_token\":\"{s}\",\"refresh_token\":\"{s}\"}}",
            .{ user.id, user.name, user.email, user.role, exp, tokens.access_token, tokens.refresh_token },
        );
        defer self.service.allocator.free(payload);

        return jwt.createJwt(self.service.allocator, payload, globals.jwt_secret);
    }

    fn sendJson(self: *AuthController, r: zap.Request, status: u16, json: []const u8) !void {
        _ = self;
        r.setStatusNumeric(status);
        try r.setHeader("Content-Type", "application/json; charset=utf-8");
        try r.sendBody(json);
    }

    fn sendError(self: *AuthController, r: zap.Request, status: u16, message: []const u8) !void {
        const error_json = try std.fmt.allocPrint(
            self.service.allocator,
            "{{\"error\":true,\"message\":\"{s}\"}}",
            .{message},
        );
        defer self.service.allocator.free(error_json);

        try self.sendJson(r, status, error_json);
    }

    fn extractJsonString(_: *AuthController, json: []const u8, key: []const u8) ?[]const u8 {
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
