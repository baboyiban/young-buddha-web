const std = @import("std");
const zap = @import("zap");
const Env = @import("../config/env.zig").Env;
const User = @import("../model/user.zig").User;
const constants = @import("../config/constants.zig");
const QueryIterator = @import("../util/query.zig").QueryIterator;
const rand = std.crypto.random;
const globals = @import("../config/globals.zig");

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

    pub fn init(allocator: std.mem.Allocator) !AuthService {
        const env = globals.getEnv();
        return .{
            .allocator = allocator,
            .client_id = env.get("GOOGLE_CLIENT_ID") orelse return error.MissingGoogleClientId,
            .client_secret = env.get("GOOGLE_CLIENT_SECRET") orelse return error.MissingGoogleClientSecret,
            .redirect_uri = env.get("GOOGLE_REDIRECT_URI") orelse return error.MissingRedirectUri,
            .scope = constants.GOOGLE_SCOPE,
        };
    }

    pub fn generateState(self: *AuthService) ![]u8 {
        var state_bytes: [32]u8 = undefined;
        rand.bytes(&state_bytes);
        return std.fmt.allocPrint(self.allocator, "{}", .{std.fmt.fmtSliceHexLower(&state_bytes)});
    }

    pub fn buildGoogleAuthUrl(self: *AuthService, state: []const u8) ![]u8 {
        return std.fmt.allocPrint(
            self.allocator,
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={s}&redirect_uri={s}&response_type=code&scope={s}&state={s}&access_type=offline&prompt=consent",
            .{ self.client_id, self.redirect_uri, self.scope, state },
        );
    }

    pub fn setSessionCookie(_: *AuthService, r: zap.Request, key: []const u8, value: []const u8) !void {
        try r.setCookie(.{
            .name = key,
            .value = value,
            .http_only = false,
            .path = "/",
            .max_age_s = 300, // 5분
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

    pub fn exchangeGoogleCode(self: *AuthService, code: []const u8) !TokenPair {
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

        const access_token = try self.parseJsonString(response, "access_token");
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
            "https://www.googleapis.com/oauth2/v1/userinfo?access_token={s}",
            .{access_token},
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

        const uri = try std.Uri.parse("https://oauth2.googleapis.com/token");
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
