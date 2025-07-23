const std = @import("std");
const zap = @import("zap");
const PaymentService = @import("service.zig").PaymentService;
const PaymentRequest = @import("model.zig").PaymentRequest;
const jwt_util = @import("../util/jwt.zig");
const json_util = @import("../util/json.zig");
const globals = @import("../config/globals.zig");

pub const PaymentController = struct {
    service: *PaymentService,

    pub fn init(service: *PaymentService) PaymentController {
        return .{ .service = service };
    }

    /// GET /api/payment?last_n=10
    pub fn list(self: *PaymentController, r: zap.Request) !void {
        const allocator = self.service.allocator;

        r.parseCookies(false);
        const jwt_cookie = r.getCookieStr(allocator, "jwt") catch {
            r.setStatusNumeric(401);
            return r.sendBody("{\"error\":true,\"message\":\"Not logged in\"}");
        };
        const payload = jwt_util.verifyJwt(allocator, jwt_cookie.?, globals.jwt_secret) catch {
            r.setStatusNumeric(401);
            return r.sendBody("{\"error\":true,\"message\":\"Invalid token\"}");
        };
        defer allocator.free(payload);

        const access_token = json_util.extractJsonString(allocator, payload, "access_token") catch null orelse {
            r.setStatusNumeric(401);
            return r.sendBody("{\"error\":true,\"message\":\"No access token in JWT\"}");
        };
        defer allocator.free(access_token);

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

        const requests = try self.service.listRequests(access_token, last_n);

        var buf = std.ArrayList(u8).init(allocator);
        defer buf.deinit();
        try buf.appendSlice("[");
        for (requests, 0..) |req, i| {
            if (i > 0) try buf.appendSlice(",");
            try buf.writer().print("{{\"id\":{d},\"name\":", .{req.id});
            try std.json.encodeJsonString(req.name, .{}, buf.writer());
            try buf.appendSlice(",\"type\":");
            try std.json.encodeJsonString(req.type, .{}, buf.writer());
            try buf.appendSlice(",\"request_date\":");
            try std.json.encodeJsonString(req.request_date, .{}, buf.writer());
            try buf.appendSlice(",\"absent_date\":");
            try std.json.encodeJsonString(req.absent_date, .{}, buf.writer());
            try buf.appendSlice(",\"time_slot\":");
            if (req.time_slot) |v| {
                try std.json.encodeJsonString(v, .{}, buf.writer());
            } else {
                try buf.appendSlice("null");
            }
            try buf.appendSlice(",\"reason\":");
            if (req.reason) |v| {
                try std.json.encodeJsonString(v, .{}, buf.writer());
            } else {
                try buf.appendSlice("null");
            }
            try buf.appendSlice(",\"status\":");
            try std.json.encodeJsonString(req.status, .{}, buf.writer());
            try buf.appendSlice(",\"approver\":");
            if (req.approver) |v| {
                try std.json.encodeJsonString(v, .{}, buf.writer());
            } else {
                try buf.appendSlice("null");
            }
            try buf.appendSlice(",\"approved_at\":");
            if (req.approved_at) |v| {
                try std.json.encodeJsonString(v, .{}, buf.writer());
            } else {
                try buf.appendSlice("null");
            }
            try buf.appendSlice(",\"comment\":");
            if (req.comment) |v| {
                try std.json.encodeJsonString(v, .{}, buf.writer());
            } else {
                try buf.appendSlice("null");
            }
            try buf.appendSlice("}");
        }
        try buf.appendSlice("]");
        r.setStatusNumeric(200);
        try r.setHeader("Content-Type", "application/json; charset=utf-8");
        try r.sendBody(buf.items);
    }

    /// POST /api/payment
    pub fn create(self: *PaymentController, r: zap.Request) !void {
        const allocator = self.service.allocator;

        r.parseCookies(false);
        const jwt_cookie = r.getCookieStr(allocator, "jwt") catch {
            r.setStatusNumeric(401);
            return r.sendBody("{\"error\":true,\"message\":\"Not logged in\"}");
        };
        const payload = jwt_util.verifyJwt(allocator, jwt_cookie.?, globals.jwt_secret) catch {
            r.setStatusNumeric(401);
            return r.sendBody("{\"error\":true,\"message\":\"Invalid token\"}");
        };
        defer allocator.free(payload);

        const access_token = json_util.extractJsonString(allocator, payload, "access_token") catch null orelse {
            r.setStatusNumeric(401);
            return r.sendBody("{\"error\":true,\"message\":\"No access token in JWT\"}");
        };
        defer allocator.free(access_token);

        const refresh_token = json_util.extractJsonString(allocator, payload, "refresh_token") catch null orelse "";
        defer allocator.free(refresh_token);

        const body = r.body orelse {
            r.setStatusNumeric(400);
            return r.sendBody("{\"error\":true,\"message\":\"Missing body\"}");
        };

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

        try self.service.addRequest(access_token, refresh_token, req);

        r.setStatusNumeric(201);
        try r.sendBody("{\"success\":true}");
    }
};
