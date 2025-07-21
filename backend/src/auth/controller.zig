const std = @import("std");
const zap = @import("zap");
const Service = @import("service.zig").AuthService;
const User = @import("../model/user.zig").User;
const jwt = @import("../util/jwt.zig");
const globals = @import("../config/globals.zig");
const constants = @import("../config/constants.zig");
const error_handler = @import("../handler/error_handler.zig");
const json_util = @import("../util/json.zig");
const errors = @import("../config/errors.zig").Errors;

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
            .name = "jwt",
            .value = jwt_token,
            .http_only = true,
            .path = "/",
            .max_age_s = 60 * 60 * 24,
            .secure = globals.isProduction(),
        });

        const redirect_url = "/?login=success";
        try r.setHeader("Location", redirect_url);
        r.setStatusNumeric(302);
        try r.sendBody("");
    }

    pub fn me(self: *AuthController, r: zap.Request) !void {
        r.parseCookies(false);
        const jwt_cookie = r.getCookieStr(self.service.allocator, "jwt") catch null;

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

            const name = json_util.extractJsonString(payload, "\"name\":\"") orelse "";
            const email = json_util.extractJsonString(payload, "\"email\":\"") orelse "";
            const role = json_util.extractJsonString(payload, "\"role\":\"") orelse "";

            const response = try std.fmt.allocPrint(
                self.service.allocator,
                "{{\"name\":\"{s}\",\"email\":\"{s}\",\"role\":\"{s}\"}}",
                .{ name, email, role },
            );
            defer self.service.allocator.free(response);

            try self.sendJson(r, 200, response);
            return;
        }

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

    fn createUserJwt(self: *AuthController, user: User, tokens: @import("service.zig").TokenPair) ![]u8 {
        const now = std.time.timestamp();
        const exp = now + 60 * 60 * 24;

        const payload = try std.fmt.allocPrint(
            self.service.allocator,
            "{{\"sub\":\"{s}\",\"name\":\"{s}\",\"email\":\"{s}\",\"role\":\"{s}\",\"exp\":{d},\"access_token\":\"{s}\",\"refresh_token\":\"{s}\"}}",
            .{ user.id, user.name, user.email, user.role, exp, tokens.access_token, tokens.refresh_token },
        );
        defer self.service.allocator.free(payload);

        return jwt.createJwt(self.service.allocator, payload, globals.jwt_secret);
    }

    fn sendJson(_: *AuthController, r: zap.Request, status: u16, json: []const u8) !void {
        r.setStatusNumeric(status);
        try r.setHeader("Content-Type", "application/json; charset=utf-8");
        try r.sendBody(json);
    }

    fn sendError(self: *AuthController, r: zap.Request, status: u16, code: []const u8, message: []const u8) !void {
        try error_handler.sendErrorJson(self.service.allocator, r, status, code, message);
    }
};
