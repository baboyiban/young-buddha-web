const std = @import("std");
const SheetsService = @import("../sheets/service.zig").SheetsService;
const PaymentRequest = @import("model.zig").PaymentRequest;
const json_util = @import("../util/json.zig");

pub const PaymentService = struct {
    allocator: std.mem.Allocator,
    sheets_service: *SheetsService,
    spreadsheet_id: []const u8,

    pub fn init(
        allocator: std.mem.Allocator,
        sheets_service: *SheetsService,
        spreadsheet_id: []const u8,
    ) PaymentService {
        return .{
            .allocator = allocator,
            .sheets_service = sheets_service,
            .spreadsheet_id = spreadsheet_id,
        };
    }

    /// A2:A 전체 읽어서 데이터 행 개수 반환
    pub fn getRowCount(self: *PaymentService, access_token: []const u8) !usize {
        const range = "데이터베이스_일정결재불참시트!A2:A";
        const response = try self.sheets_service.callSheetsApi(access_token, self.spreadsheet_id, range);
        const values_json = try json_util.extractJsonArray(self.allocator, response, "values") orelse return 0;
        return values_json.len;
    }

    /// 마지막 N줄만 반환
    pub fn listRequests(self: *PaymentService, access_token: []const u8, last_n: usize) ![]PaymentRequest {
        const total_rows = try self.getRowCount(access_token);
        if (total_rows == 0) return &[_]PaymentRequest{};
        const start_row = 2 + (if (total_rows > last_n) total_rows - last_n else 0);
        const end_row = 1 + total_rows;
        const range = try std.fmt.allocPrint(self.allocator, "데이터베이스_일정결재불참시트!A{d}:K{d}", .{ start_row, end_row });
        defer self.allocator.free(range);

        const response = try self.sheets_service.callSheetsApi(access_token, self.spreadsheet_id, range);
        const values_json = try json_util.extractJsonArray(self.allocator, response, "values") orelse return &[_]PaymentRequest{};
        var list = try self.allocator.alloc(PaymentRequest, values_json.len);
        for (values_json, 0..) |row, i| {
            if (row == .array) {
                const items = row.array.items;
                list[i] = PaymentRequest{
                    .id = if (items.len > 0 and items[0] == .string) std.fmt.parseInt(i64, items[0].string, 10) catch 0 else 0,
                    .name = if (items.len > 1 and items[1] == .string) items[1].string else "",
                    .type = if (items.len > 2 and items[2] == .string) items[2].string else "",
                    .request_date = if (items.len > 3 and items[3] == .string) items[3].string else "",
                    .absent_date = if (items.len > 4 and items[4] == .string) items[4].string else "",
                    .time_slot = if (items.len > 5 and items[5] == .string and items[5].string.len > 0) items[5].string else null,
                    .reason = if (items.len > 6 and items[6] == .string and items[6].string.len > 0) items[6].string else null,
                    .status = if (items.len > 7 and items[7] == .string) items[7].string else "",
                    .approver = if (items.len > 8 and items[8] == .string and items[8].string.len > 0) items[8].string else null,
                    .approved_at = if (items.len > 9 and items[9] == .string and items[9].string.len > 0) items[9].string else null,
                    .comment = if (items.len > 10 and items[10] == .string and items[10].string.len > 0) items[10].string else null,
                };
            } else {
                list[i] = PaymentRequest{
                    .id = 0,
                    .name = "",
                    .type = "",
                    .request_date = "",
                    .absent_date = "",
                    .time_slot = null,
                    .reason = null,
                    .status = "",
                    .approver = null,
                    .approved_at = null,
                    .comment = null,
                };
            }
        }
        return list;
    }

    /// 새 결재 요청 추가 (append)
    pub fn addRequest(self: *PaymentService, access_token: []const u8, req: PaymentRequest) !void {
        const row_count = try self.getRowCount(access_token);
        const id = row_count + 1;

        const range = "데이터베이스_일정불참결재시트";
        // values: [[id, name, type, request_date, absent_date, time_slot, reason, status, approver, approved_at, comment]]
        var buf = std.ArrayList(u8).init(self.allocator);
        defer buf.deinit();

        try buf.appendSlice("{\"values\":[[");
        try buf.writer().print("{d},", .{id});
        try std.json.encodeJsonString(req.name, .{}, buf.writer());
        try buf.appendSlice(",");
        try std.json.encodeJsonString(req.type, .{}, buf.writer());
        try buf.appendSlice(",");
        try std.json.encodeJsonString(req.request_date, .{}, buf.writer());
        try buf.appendSlice(",");
        try std.json.encodeJsonString(req.absent_date, .{}, buf.writer());
        try buf.appendSlice(",");
        if (req.time_slot) |v| {
            try std.json.encodeJsonString(v, .{}, buf.writer());
        } else {
            try buf.appendSlice("null");
        }
        try buf.appendSlice(",");
        if (req.reason) |v| {
            try std.json.encodeJsonString(v, .{}, buf.writer());
        } else {
            try buf.appendSlice("null");
        }
        try buf.appendSlice(",");
        try std.json.encodeJsonString(req.status, .{}, buf.writer());
        try buf.appendSlice(",");
        if (req.approver) |v| {
            try std.json.encodeJsonString(v, .{}, buf.writer());
        } else {
            try buf.appendSlice("null");
        }
        try buf.appendSlice(",");
        if (req.approved_at) |v| {
            try std.json.encodeJsonString(v, .{}, buf.writer());
        } else {
            try buf.appendSlice("null");
        }
        try buf.appendSlice(",");
        if (req.comment) |v| {
            try std.json.encodeJsonString(v, .{}, buf.writer());
        } else {
            try buf.appendSlice("null");
        }
        try buf.appendSlice("]]}");

        const values_json = buf.items;

        std.log.info("append spreadsheet_id: {s}", .{self.spreadsheet_id});
        std.log.info("append range: {s}", .{range});
        std.log.info("append values_json: {s}", .{values_json});
        const result = try self.sheets_service.appendSheetsApi(access_token, self.spreadsheet_id, range, values_json);
        std.log.info("append result: {s}", .{result});
        _ = try self.sheets_service.appendSheetsApi(access_token, self.spreadsheet_id, range, values_json);
    }
};
