const std = @import("std");
const zap = @import("zap");
const OAuthController = @import("../controller/oauth_controller.zig").OAuthController;

pub const OAuthHandler = struct {
    controller: *OAuthController,

    pub fn init(controller: *OAuthController) OAuthHandler {
        return .{ .controller = controller };
    }

    pub fn handleGoogleAuth(self: *OAuthHandler, r: zap.Request) !void {
        return try self.controller.googleAuth(r);
    }
    pub fn handleGoogleCallback(self: *OAuthHandler, r: zap.Request) !void {
        return try self.controller.googleCallback(r);
    }
    pub fn handleMe(self: *OAuthHandler, r: zap.Request) !void {
        return try self.controller.me(r);
    }
    pub fn handleLogout(self: *OAuthHandler, r: zap.Request) !void {
        return try self.controller.logout(r);
    }
    pub fn handleReadSheet(self: *OAuthHandler, r: zap.Request) !void {
        return try self.controller.readSheet(r);
    }
};
