const std = @import("std");
const sqlite = @import("sqlite");
pub const Service = @import("service.zig").DatabaseService;
pub const Controller = @import("controller.zig").DatabaseController;

pub const DatabaseApp = struct {
    service: Service,
    controller: Controller,

    pub fn init(allocator: std.mem.Allocator, db: *sqlite.Db) !DatabaseApp {
        var service = Service.init(allocator, db);
        try service.createTable();
        const controller = Controller.init(&service);
        return DatabaseApp{
            .service = service,
            .controller = controller,
        };
    }
};
