const std = @import("std");
const AuthService = @import("../auth/service.zig").AuthService;
pub const Service = @import("service.zig").SheetsService;
pub const Controller = @import("controller.zig").SheetsController;

pub const SheetsApp = struct {
    service: Service,
    controller: Controller,

    pub fn init(allocator: std.mem.Allocator, auth_service: *AuthService) SheetsApp {
        var service = Service.init(allocator, auth_service);
        const controller = Controller.init(&service);
        return SheetsApp{
            .service = service,
            .controller = controller,
        };
    }
};
