const std = @import("std");
const zap = @import("zap");
const PaymentService = @import("service.zig").PaymentService;
const PaymentRequest = @import("model.zig").PaymentRequest;

pub const PaymentController = struct {
    service: *PaymentService,

    pub fn init(service: *PaymentService) PaymentController {
        return .{ .service = service };
    }

    /// GET /api/payment?last_n=10
    pub fn list(self: *PaymentController, r: zap.Request) !void {
        // 쿼리 파라미터 last_n 파싱 (기본값 10)
        var last_n: usize = 10;
        if (r.query) |query| {
            if (std.mem.indexOf(u8, query, "last_n=")) |idx| {
                const start = idx + "last_n=".len;
                var end = start;
                while (end < query.len and query[end] >= '0' and query[end] <= '9') : (end += 1) {}
                const num_str = query[start..end];
                last_n = std.fmt.parseInt(usize, num_str, 10) catch 10;
            }
        }

        const requests = try self.service.listRequests(last_n);

        // JSON 배열로 변환
        var buf = std.ArrayList(u8).init(self.service.allocator);
        defer buf.deinit();
        try buf.appendSlice("[");
        for (requests, 0..) |req, i| {
            if (i > 0) try buf.appendSlice(",");
            try buf.writer().print("{{\"id\":{d},\"name\":\"{s}\",\"type\":\"{s}\",\"request_date\":\"{s}\",\"absent_date\":\"{s}\",\"time_slot\":{s},\"reason\":{s},\"status\":\"{s}\",\"approver\":{s},\"approved_at\":{s},\"comment\":{s}}}", .{
                req.id,
                req.name,
                req.type,
                req.request_date,
                req.absent_date,
                if (req.time_slot) |v| blk: {
                    var tmp = std.ArrayList(u8).init(self.service.allocator);
                    defer tmp.deinit();
                    try std.json.encodeJsonString(v, .{}, tmp.writer());
                    break :blk tmp.items;
                } else "null",
                if (req.reason) |v|
                blk: {
                    var tmp = std.ArrayList(u8).init(self.service.allocator);
                    defer tmp.deinit();
                    try std.json.encodeJsonString(v, .{}, tmp.writer());
                    break :blk tmp.items;
                } else "null",
                req.status,
                if (req.approver) |v|
                blk: {
                    var tmp = std.ArrayList(u8).init(self.service.allocator);
                    defer tmp.deinit();
                    try std.json.encodeJsonString(v, .{}, tmp.writer());
                    break :blk tmp.items;
                } else "null",
                if (req.approved_at) |v|
                blk: {
                    var tmp = std.ArrayList(u8).init(self.service.allocator);
                    defer tmp.deinit();
                    try std.json.encodeJsonString(v, .{}, tmp.writer());
                    break :blk tmp.items;
                } else "null",
                if (req.comment) |v|
                blk: {
                    var tmp = std.ArrayList(u8).init(self.service.allocator);
                    defer tmp.deinit();
                    try std.json.encodeJsonString(v, .{}, tmp.writer());
                    break :blk tmp.items;
                } else "null",
            });
        }
        try buf.appendSlice("]");
        r.setStatusNumeric(200);
        try r.setHeader("Content-Type", "application/json; charset=utf-8");
        try r.sendBody(buf.items);
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
        const absent_date = getStr(obj, "absent_date") orelse {
            r.setStatusNumeric(400);
            return r.sendBody("{\"error\":true,\"message\":\"Missing absent_date\"}");
        };
        const time_slot = getStr(obj, "time_slot");
        const reason = getStr(obj, "reason");
        const status = getStr(obj, "status") orelse "대기";
        const approver = getStr(obj, "approver");
        const approved_at = getStr(obj, "approved_at");
        const comment = getStr(obj, "comment");

        // id는 service에서 자동 할당
        const req = PaymentRequest{
            .id = 0,
            .name = name,
            .type = type_,
            .request_date = request_date,
            .absent_date = absent_date,
            .time_slot = time_slot,
            .reason = reason,
            .status = status,
            .approver = approver,
            .approved_at = approved_at,
            .comment = comment,
        };
        try self.service.addRequest(req);

        r.setStatusNumeric(201);
        try r.sendBody("{\"success\":true}");
    }
};
