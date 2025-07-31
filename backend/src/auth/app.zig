const std = @import("std");
const Env = @import("../config/env.zig").Env;
pub const Service = @import("service.zig").AuthService;
pub const Controller = @import("controller.zig").AuthController;

pub const AuthApp = struct {
    service: Service,
    controller: Controller,

    pub fn init(self: *AuthApp, allocator: std.mem.Allocator) !void {
        self.service = try Service.init(allocator);
        self.controller = Controller.init(&self.service);
    }
};
