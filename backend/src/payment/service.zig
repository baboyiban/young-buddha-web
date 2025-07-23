const std = @import("std");
const AuthService = @import("../auth/service.zig").AuthService;
const PaymentRequest = @import("model.zig").PaymentRequest;
const json_util = @import("../util/json.zig");

pub const PaymentService = struct {
    allocator: std.mem.Allocator,
    auth_service: *AuthService,
    spreadsheet_id: []const u8,

    pub fn init(allocator: std.mem.Allocator, auth_service: *AuthService, spreadsheet_id: []const u8) PaymentService {
        return .{
            .allocator = allocator,
            .auth_service = auth_service,
            .spreadsheet_id = spreadsheet_id,
        };
    }

    /// A2:A 전체 읽어서 데이터 행 개수 반환
    pub fn getRowCount(self: *PaymentService) !usize {
        const range = "데이터베이스_일정결재불참시트!A2:A";
        const response = try self.auth_service.callSheetsApi(self.spreadsheet_id, range);
        // response는 JSON: { values: [ [id], [id], ... ] }
        const values_json = try json_util.extractJsonArray(self.allocator, response, "values") orelse return 0;
        return values_json.len;
    }

    /// 마지막 N줄만 반환
    pub fn listRequests(self: *PaymentService, last_n: usize) ![]PaymentRequest {
        const total_rows = try self.getRowCount();
        if (total_rows == 0) return &[_]PaymentRequest{};
        const start_row = 2 + (if (total_rows > last_n) total_rows - last_n else 0);
        const end_row = 1 + total_rows;
        const range = try std.fmt.allocPrint(self.allocator, "데이터베이스_일정결재불참시트!A{d}:K{d}", .{ start_row, end_row });
        defer self.allocator.free(range);

        const response = try self.auth_service.callSheetsApi(self.spreadsheet_id, range);
        // response: { values: [ [...], [...], ... ] }
        const values_json = try json_util.extractJsonArray(self.allocator, response, "values") orelse return &[_]PaymentRequest{};
        var list = try self.allocator.alloc(PaymentRequest, values_json.len);
        for (values_json, 0..) |row, i| {
            // row: [id, name, type, request_date, absent_date, time_slot, reason, status, approver, approved_at, comment]
            list[i] = PaymentRequest{
                .id = std.fmt.parseInt(i64, row[0], 10) catch 0,
                .name = row[1],
                .type = row[2],
                .request_date = row[3],
                .absent_date = row[4],
                .time_slot = if (row[5].len > 0) row[5] else null,
                .reason = if (row[6].len > 0) row[6] else null,
                .status = row[7],
                .approver = if (row[8].len > 0) row[8] else null,
                .approved_at = if (row[9].len > 0) row[9] else null,
                .comment = if (row[10].len > 0) row[10] else null,
            };
        }
        return list;
    }

    /// 새 결재 요청 추가 (append)
    pub fn addRequest(self: *PaymentService, req: PaymentRequest) !void {
        // id 자동 할당
        const row_count = try self.getRowCount();
        const id = row_count + 1;

        const range = "데이터베이스_일정결재불참시트!A:K";
        // values: [[id, name, type, request_date, absent_date, time_slot, reason, status, approver, approved_at, comment]]
        const values = try std.fmt.allocPrint(self.allocator, "[[{d},\"{s}\",\"{s}\",\"{s}\",\"{s}\",{s},{s},\"{s}\",{s},{s},{s}]]", .{
            id,
            req.name,
            req.type,
            req.request_date,
            req.absent_date,
            req.time_slot orelse "null",
            req.reason orelse "null",
            req.status,
            req.approver orelse "null",
            req.approved_at orelse "null",
            req.comment orelse "null",
        });
        defer self.allocator.free(values);

        // POST append API 호출
        try self.auth_service.appendSheetsApi(self.spreadsheet_id, range, values);
    }
};
