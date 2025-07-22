const std = @import("std");
const Env = @import("../config/env.zig").Env;
pub const Service = @import("service.zig").AuthService;
pub const Controller = @import("controller.zig").AuthController;

pub const AuthApp = struct {
    service: Service,
    controller: Controller,

    pub fn init(allocator: std.mem.Allocator, env: *Env) !AuthApp {
        var app = AuthApp{
            .service = try Service.init(allocator, env),
            .controller = undefined,
        };
        app.controller = Controller.init(&app.service);
        return app;
    }
};
