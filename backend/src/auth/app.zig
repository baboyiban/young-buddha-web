const std = @import("std");
const Env = @import("../config/env.zig").Env;
pub const Service = @import("service.zig").AuthService;
pub const Controller = @import("controller.zig").AuthController;

pub const AuthApp = struct {
    service: Service,
    controller: Controller,

    pub fn init(self: *AuthApp, allocator: std.mem.Allocator, env: *Env) !void {
        self.service = try Service.init(allocator, env);
        self.controller = Controller.init(&self.service);
    }
};
