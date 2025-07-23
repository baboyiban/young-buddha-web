const std = @import("std");
const AuthService = @import("../auth/service.zig").AuthService;
pub const Service = @import("service.zig").PaymentService;
pub const Controller = @import("controller.zig").PaymentController;

pub const PaymentApp = struct {
    service: Service,
    controller: Controller,

    pub fn init(allocator: std.mem.Allocator, auth_service: *AuthService, spreadsheet_id: []const u8) PaymentApp {
        var service = Service.init(allocator, auth_service, spreadsheet_id);
        const controller = Controller.init(&service);
        return PaymentApp{
            .service = service,
            .controller = controller,
        };
    }
};
