const std = @import("std");
const zap = @import("zap");
const PaymentService = @import("service.zig").PaymentService;
const PaymentRequest = @import("model.zig").PaymentRequest;

pub const PaymentController = struct {
    service: *PaymentService,

    pub fn init(service: *PaymentService) PaymentController {
        return .{ .service = service };
    }

    /// POST /api/payment
    pub fn create(self: *PaymentController, r: zap.Request) !void {
        const allocator = self.service.allocator;
        const body = r.body orelse {
            r.setStatusNumeric(400);
            return r.sendBody("{\"error\":true,\"message\":\"Missing body\"}");
        };

        // JSON 파싱
        var parsed = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch {
            r.setStatusNumeric(400);
            return r.sendBody("{\"error\":true,\"message\":\"Invalid JSON\"}");
        };
        defer parsed.deinit();

        const obj = parsed.value.object;
        const getStr = struct {
            fn get(o: std.json.ObjectMap, key: []const u8) ?[]const u8 {
                if (o.get(key)) |v| if (v == .string) return v.string;
                return null;
            }
        }.get;

        const name = getStr(obj, "name") orelse {
            r.setStatusNumeric(400);
            return r.sendBody("{\"error\":true,\"message\":\"Missing name\"}");
        };
        const type_ = getStr(obj, "type") orelse {
            r.setStatusNumeric(400);
            return r.sendBody("{\"error\":true,\"message\":\"Missing type\"}");
        };
        const request_date = getStr(obj, "request_date") orelse {
            r.setStatusNumeric(400);
            return r.sendBody("{\"error\":true,\"message\":\"Missing request_date\"}");
        };
        const absent_date = getStr(obj, "absent_date");
        const partial_schedule = getStr(obj, "partial_schedule");
        const reason = getStr(obj, "reason");

        const req = PaymentRequest{
            .id = 0,
            .name = name,
            .type = type_,
            .request_date = request_date,
            .absent_date = absent_date,
            .partial_schedule = partial_schedule,
            .reason = reason,
        };
        try self.service.addRequest(req);

        r.setStatusNumeric(201);
        try r.sendBody("{\"success\":true}");
    }

    /// GET /api/payment
    pub fn list(self: *PaymentController, r: zap.Request) !void {
        const allocator = self.service.allocator;
        const requests = try self.service.listRequests();

        var buf = std.ArrayList(u8).init(allocator);
        defer buf.deinit();
        try buf.appendSlice("[");
        for (requests, 0..) |req, i| {
            if (i > 0) try buf.appendSlice(",");
            try buf.writer().print("{{\"id\":{d},\"name\":\"{s}\",\"type\":\"{s}\",\"request_date\":\"{s}\",\"absent_date\":{s},\"partial_schedule\":{s},\"reason\":{s}}}", .{
                req.id,
                req.name,
                req.type,
                req.request_date,
                if (req.absent_date) |v| blk: {
                    var tmp_buf = std.ArrayList(u8).init(allocator);
                    defer tmp_buf.deinit();
                    try std.json.encodeJsonString(v, .{}, tmp_buf.writer());
                    break :blk tmp_buf.items;
                } else "null",
                if (req.partial_schedule) |v|
                blk: {
                    var tmp_buf = std.ArrayList(u8).init(allocator);
                    defer tmp_buf.deinit();
                    try std.json.encodeJsonString(v, .{}, tmp_buf.writer());
                    break :blk tmp_buf.items;
                } else "null",
                if (req.reason) |v|
                blk: {
                    var tmp_buf = std.ArrayList(u8).init(allocator);
                    defer tmp_buf.deinit();
                    try std.json.encodeJsonString(v, .{}, tmp_buf.writer());
                    break :blk tmp_buf.items;
                } else "null",
            });
        }
        try buf.appendSlice("]");
        r.setStatusNumeric(200);
        try r.setHeader("Content-Type", "application/json; charset=utf-8");
        try r.sendBody(buf.items);
    }
};
