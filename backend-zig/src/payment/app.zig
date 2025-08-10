const std = @import("std");
const SheetsService = @import("../sheets/service.zig").SheetsService;
pub const Service = @import("service.zig").PaymentService;
pub const Controller = @import("controller.zig").PaymentController;

pub const PaymentApp = struct {
    service: Service,
    controller: Controller,

    pub fn init(self: *PaymentApp, allocator: std.mem.Allocator, sheets_service: *SheetsService, spreadsheet_id: []const u8) void {
        self.service = Service.init(allocator, sheets_service, spreadsheet_id);
        self.controller = Controller.init(&self.service);
    }

    pub fn deinit(self: *PaymentApp) void {
        self.service.deinit();
    }
};
