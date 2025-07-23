const std = @import("std");
const AuthService = @import("../auth/service.zig").AuthService;
pub const Service = @import("service.zig").SheetsService;
pub const Controller = @import("controller.zig").SheetsController;

pub const SheetsApp = struct {
    service: Service,
    controller: Controller,

    pub fn init(self: *SheetsApp, allocator: std.mem.Allocator, auth_service: *AuthService) void {
        self.service = Service.init(allocator, auth_service);
        self.controller = Controller.init(&self.service);
    }
};
