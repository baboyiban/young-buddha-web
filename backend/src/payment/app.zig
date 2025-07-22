const std = @import("std");
const sqlite = @import("sqlite");
pub const Service = @import("service.zig").PaymentService;
pub const Controller = @import("controller.zig").PaymentController;

pub const PaymentApp = struct {
    service: Service,
    controller: Controller,

    pub fn init(allocator: std.mem.Allocator, db: *sqlite.Db) !PaymentApp {
        var service = Service.init(allocator, db);
        try service.createTable();
        const controller = Controller.init(&service);
        return PaymentApp{
            .service = service,
            .controller = controller,
        };
    }
};
