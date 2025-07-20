const std = @import("std");
const crypto = std.crypto;

/// base64url 인코딩 (패딩 없음)
pub fn base64UrlEncode(allocator: std.mem.Allocator, input: []const u8) !struct {
    buf: []u8, // 할당한 전체 버퍼
    slice: []u8, // 실제 base64url 결과 슬라이스
} {
    const encoder = std.base64.standard.Encoder;
    const encoded_len = encoder.calcSize(input.len);
    var buf = try allocator.alloc(u8, encoded_len);
    _ = encoder.encode(buf, input);

    // + → -, / → _, = 제거
    var j: usize = 0;
    for (buf) |c| {
        if (c == '+') buf[j] = '-' else if (c == '/') buf[j] = '_' else if (c == '=') continue else buf[j] = c;
        j += 1;
    }
    return .{ .buf = buf, .slice = buf[0..j] };
}

/// base64url 디코딩
pub fn base64UrlDecode(allocator: std.mem.Allocator, input: []const u8) ![]u8 {
    // - → +, _ → /
    const buf = try allocator.dupe(u8, input);
    for (buf) |*c| {
        if (c.* == '-') c.* = '+' else if (c.* == '_') c.* = '/';
    }
    // 패딩 추가
    const pad = (4 - (buf.len % 4)) % 4;
    const padded = try allocator.alloc(u8, buf.len + pad);
    std.mem.copyForwards(u8, padded, buf);
    for (padded[buf.len..]) |*c| c.* = '=';

    defer allocator.free(buf);

    // Calculate decoded length
    const decoder = std.base64.standard.Decoder;
    const decoded_len = try decoder.calcSizeForSlice(padded);
    const decoded = try allocator.alloc(u8, decoded_len);

    try decoder.decode(decoded, padded);
    return decoded;
}

/// HMAC-SHA256
pub fn hmacSha256(allocator: std.mem.Allocator, key: []const u8, msg: []const u8) ![]u8 {
    var mac: [32]u8 = undefined;
    var hmac = crypto.auth.hmac.sha2.HmacSha256.init(key);
    hmac.update(msg);
    hmac.final(&mac);
    return allocator.dupe(u8, &mac);
}

/// JWT 생성 (payload는 json string)
pub fn createJwt(allocator: std.mem.Allocator, payload: []const u8, secret: []const u8) ![]u8 {
    const header = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
    const header_b64 = try base64UrlEncode(allocator, header);
    const payload_b64 = try base64UrlEncode(allocator, payload);
    const msg = try std.fmt.allocPrint(allocator, "{s}.{s}", .{ header_b64.slice, payload_b64.slice });
    defer allocator.free(header_b64.buf);
    defer allocator.free(payload_b64.buf);

    const sig = try hmacSha256(allocator, secret, msg);
    const sig_b64 = try base64UrlEncode(allocator, sig);
    defer allocator.free(sig);

    const jwt = try std.fmt.allocPrint(allocator, "{s}.{s}", .{ msg, sig_b64.slice });
    defer allocator.free(msg);
    defer allocator.free(sig_b64.buf);
    return jwt;
}

/// JWT 검증 및 payload 반환 (exp 만료 체크 포함)
pub fn verifyJwt(allocator: std.mem.Allocator, jwt: []const u8, secret: []const u8) ![]u8 {
    var parts = std.mem.splitScalar(u8, jwt, '.');
    var arr: [3][]const u8 = undefined;
    var i: usize = 0;
    while (parts.next()) |p| : (i += 1) {
        if (i >= 3) return error.InvalidJwt;
        arr[i] = p;
    }
    if (i != 3) {
        return error.InvalidJwt;
    }
    const msg = try std.fmt.allocPrint(allocator, "{s}.{s}", .{ arr[0], arr[1] });
    defer allocator.free(msg);
    const sig = try base64UrlDecode(allocator, arr[2]);
    defer allocator.free(sig);
    var mac: [32]u8 = undefined;
    crypto.auth.hmac.sha2.HmacSha256.create(&mac, msg, secret);
    if (!std.mem.eql(u8, sig, &mac)) return error.InvalidSignature;
    const payload = try base64UrlDecode(allocator, arr[1]);
    // exp 만료 체크 (payload는 json)
    if (std.mem.indexOf(u8, payload, "\"exp\":")) |exp_idx| {
        const exp_start = exp_idx + 6;
        var exp_end = exp_start;
        while (exp_end < payload.len and payload[exp_end] >= '0' and payload[exp_end] <= '9') : (exp_end += 1) {}
        const exp_str = payload[exp_start..exp_end];
        const exp = std.fmt.parseInt(i64, exp_str, 10) catch return error.InvalidExp;
        const now = std.time.timestamp();
        if (now > exp) return error.TokenExpired;
    }
    return payload;
}
