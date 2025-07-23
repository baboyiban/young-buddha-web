const std = @import("std");
const AuthService = @import("../auth/service.zig").AuthService;
pub const Service = @import("service.zig").PaymentService;
pub const Controller = @import("controller.zig").PaymentController;

pub const PaymentApp = struct {
    service: Service,
    controller: Controller,

    pub fn init(self: *PaymentApp, allocator: std.mem.Allocator, auth_service: *AuthService, spreadsheet_id: []const u8) void {
        self.service = Service.init(allocator, auth_service, spreadsheet_id);
        self.controller = Controller.init(&self.service);
    }
};
