const std = @import("std");
const zap = @import("zap");
const Service = @import("service.zig").AuthService;
const User = @import("model/user.zig").User;
const jwt = @import("../util/jwt.zig");
const globals = @import("../config/globals.zig");
const constants = @import("../config/constants.zig");
const ResponseHelper = @import("../util/response.zig").ResponseHelper;
const json_util = @import("../util/json.zig");
const errors = @import("../error/errors.zig").Errors;

pub const AuthController = struct {
    service: *Service,

    pub fn init(service: *Service) AuthController {
        return .{ .service = service };
    }

    pub fn googleAuth(self: *AuthController, r: zap.Request) !void {
        // 메모리 할당 안전성 개선
        var state: []u8 = undefined;
        var auth_url: []u8 = undefined;
        var response: []u8 = undefined;

        // 에러 처리와 함께 state 생성
        state = self.service.generateState() catch |err| {
            std.log.err("Failed to generate state: {}", .{err});
            return self.sendError(r, 500, "INTERNAL_ERROR", "Failed to generate authentication state");
        };
        defer self.service.allocator.free(state);

        // 에러 처리와 함께 auth URL 생성
        auth_url = self.service.buildGoogleAuthUrl(state) catch |err| {
            std.log.err("Failed to build auth URL: {}", .{err});
            return self.sendError(r, 500, "INTERNAL_ERROR", "Failed to build authentication URL");
        };
        defer self.service.allocator.free(auth_url);

        // 세션 쿠키 설정
        self.service.setSessionCookie(r, constants.OAUTH_STATE_COOKIE_NAME, state) catch |err| {
            std.log.err("Failed to set session cookie: {}", .{err});
            return self.sendError(r, 500, "INTERNAL_ERROR", "Failed to set session cookie");
        };

        // JSON 응답 생성
        response = std.fmt.allocPrint(
            self.service.allocator,
            "{{\"auth_url\":\"{s}\"}}",
            .{auth_url},
        ) catch |err| {
            std.log.err("Failed to format response: {}", .{err});
            return self.sendError(r, 500, "INTERNAL_ERROR", "Failed to format response");
        };
        defer self.service.allocator.free(response);

        try ResponseHelper.sendJson(r, 200, response);
    }

    pub fn googleCallback(self: *AuthController, r: zap.Request) !void {
        r.parseCookies(false);

        const code = self.service.getQueryParam(r, "code") catch {
            return self.sendError(r, 400, "MISSING_AUTH_CODE", errors.MissingAuthCode);
        };
        const state = self.service.getQueryParam(r, "state") catch {
            return self.sendError(r, 400, "MISSING_STATE", errors.MissingState);
        };

        const saved_state = self.service.getSessionCookie(r, constants.OAUTH_STATE_COOKIE_NAME) orelse {
            return self.sendError(r, 401, "INVALID_SESSION", errors.InvalidSession);
        };

        if (!std.mem.eql(u8, state, saved_state)) {
            return self.sendError(r, 401, "STATE_MISMATCH", errors.StateMismatch);
        }

        const tokens = self.service.exchangeGoogleCode(code) catch {
            return self.sendError(r, 500, "EXCHANGE_FAILED", errors.ExchangeFailed);
        };
        defer self.service.allocator.free(tokens.access_token);
        defer if (tokens.refresh_token.len > 0) self.service.allocator.free(tokens.refresh_token);

        const user = self.service.getGoogleUserInfo(tokens.access_token) catch {
            return self.sendError(r, 500, "USERINFO_FAILED", errors.UserInfoFailed);
        };

        const jwt_token = try self.createUserJwt(user, tokens);
        defer self.service.allocator.free(jwt_token);

        try r.setCookie(.{
            .name = constants.JWT_COOKIE_NAME,
            .value = jwt_token,
            .http_only = true,
            .path = "/",
            .max_age_s = constants.SESSION_COOKIE_EXPIRY_SECONDS,
            .secure = globals.isProduction(),
        });

        const redirect_url = "/?login=success";
        try r.setHeader("Location", redirect_url);
        r.setStatusNumeric(302);
        try r.sendBody("");
    }

    pub fn me(self: *AuthController, r: zap.Request) !void {
        r.parseCookies(false);

        // 안전한 쿠키 처리
        const jwt_cookie = r.getCookieStr(self.service.allocator, constants.JWT_COOKIE_NAME) catch |err| blk: {
            std.log.warn("Failed to get JWT cookie: {}", .{err});
            break :blk null;
        };

        if (jwt_cookie) |token| {
            defer self.service.allocator.free(token);
            const payload = jwt.verifyJwt(self.service.allocator, token, globals.jwt_secret) catch |err| {
                switch (err) {
                    error.TokenExpired => try self.sendError(r, 401, "TOKEN_EXPIRED", "Token expired"),
                    error.InvalidSignature => try self.sendError(r, 401, "INVALID_TOKEN", "Invalid token"),
                    else => try self.sendError(r, 401, "INVALID_TOKEN", "Invalid token"),
                }
                return;
            };
            defer self.service.allocator.free(payload);

            // 변경: std.json 기반으로 값 추출
            const name = try json_util.extractJsonString(self.service.allocator, payload, "name") orelse "";
            const email = try json_util.extractJsonString(self.service.allocator, payload, "email") orelse "";
            const role = try json_util.extractJsonString(self.service.allocator, payload, "role") orelse "";

            const response = try std.fmt.allocPrint(
                self.service.allocator,
                "{{\"name\":\"{s}\",\"email\":\"{s}\",\"role\":\"{s}\"}}",
                .{ name, email, role },
            );
            defer self.service.allocator.free(response);

            try ResponseHelper.sendJson(r, 200, response);
            return;
        }

        r.setStatusNumeric(401);
        try r.sendBody("{\"error\":true,\"message\":\"Not logged in\",\"code\":\"NO_TOKEN\"}");
    }

    pub fn logout(_: *AuthController, r: zap.Request) !void {
        try r.setCookie(.{
            .name = constants.JWT_COOKIE_NAME,
            .value = "",
            .http_only = true,
            .path = "/",
            .max_age_s = 0,
        });

        r.setStatusNumeric(200);
        try r.sendBody("{\"success\":true}");
    }

    fn createUserJwt(self: *AuthController, user: User, tokens: @import("service.zig").TokenPair) ![]u8 {
        const now = std.time.timestamp();
        const exp = now + constants.JWT_EXPIRY_SECONDS;

        const payload = try std.fmt.allocPrint(
            self.service.allocator,
            "{{\"sub\":\"{s}\",\"name\":\"{s}\",\"email\":\"{s}\",\"role\":\"{s}\",\"exp\":{d},\"access_token\":\"{s}\",\"refresh_token\":\"{s}\"}}",
            .{ user.id, user.name, user.email, user.role, exp, tokens.access_token, tokens.refresh_token },
        );
        defer self.service.allocator.free(payload);

        return jwt.createJwt(self.service.allocator, payload, globals.jwt_secret);
    }

    fn sendError(self: *AuthController, r: zap.Request, status: u16, code: []const u8, message: []const u8) !void {
        try ResponseHelper.sendError(self.service.allocator, r, status, code, message);
    }
};
