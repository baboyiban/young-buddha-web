const SheetController = @import("../controller/sheet_controller.zig").SheetController;
const zap = @import("zap");

pub const SheetHandler = struct {
    controller: *SheetController,

    pub fn init(controller: *SheetController) SheetHandler {
        return .{ .controller = controller };
    }

    pub fn handleReadSheet(self: *SheetHandler, r: zap.Request) !void {
        return try self.controller.readSheet(r);
    }

    pub fn handleWriteSheet(self: *SheetHandler, r: zap.Request) !void {
        return try self.controller.writeSheet(r);
    }
};
