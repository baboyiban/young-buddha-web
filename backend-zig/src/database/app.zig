const std = @import("std");
const sqlite = @import("sqlite");
pub const Service = @import("service.zig").DatabaseService;
pub const Controller = @import("controller.zig").DatabaseController;

pub const DatabaseApp = struct {
    service: Service,
    controller: Controller,

    pub fn init(self: *DatabaseApp, allocator: std.mem.Allocator, db: *sqlite.Db) !void {
        self.service = Service.init(allocator, db);
        try self.service.createTable();
        self.controller = Controller.init(&self.service);
    }

    pub fn deinit(self: *DatabaseApp) void {
        self.service.deinit();
    }
};
