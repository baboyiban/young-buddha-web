const std = @import("std");
const env = @import("env.zig");
const zap = @import("zap");

const GOOGLE_CLIENT_ID = "574665261370-kijb3qoqaq6ka9vem42hvobqu0gmq9aj.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URI = "http://localhost:8080/auth/google/callback";
const GOOGLE_SCOPE = "openid%20email%20profile";

pub fn handle_oauth_google(r: anytype) !void {
    const url = try build_google_auth_url();
    try send_redirect(r, url);
}

fn build_google_auth_url() ![]u8 {
    return std.fmt.allocPrint(std.heap.page_allocator, "https://accounts.google.com/o/oauth2/v2/auth?client_id={s}&redirect_uri={s}&response_type=code&scope={s}&state={s}", .{ GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, GOOGLE_SCOPE, "random_state" });
}

pub fn handle_oauth_google_callback(r: anytype) !void {
    const allocator = std.heap.page_allocator;
    const query = r.query orelse "";
    var code: ?[]const u8 = null;

    // code 파라미터 추출
    var it = std.mem.tokenizeSequence(u8, query, "&");
    while (it.next()) |kv| {
        if (std.mem.startsWith(u8, kv, "code=")) {
            code = kv[5..];
            break;
        }
    }
    if (code == null) {
        if (code == null) {
            r.setStatus(zap.http.StatusCode.bad_request);
            return try r.sendBody("Missing code");
        }

        return try r.sendBody("Missing code");
    }

    // .env에서 client_secret 읽기
    const client_secret = try env.get_env_var_from_file(allocator, "GOOGLE_CLIENT_SECRET", "../.env") orelse return error.MissingSecret;

    // curl 명령어 준비
    const curl_cmd = try std.fmt.allocPrint(allocator, "curl -s -X POST https://oauth2.googleapis.com/token -d \"code={s}&client_id={s}&client_secret={s}&redirect_uri={s}&grant_type=authorization_code\"", .{ code.?, GOOGLE_CLIENT_ID, client_secret, GOOGLE_REDIRECT_URI });

    // Zig 0.14: std.process.Child 사용
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const proc_alloc = arena.allocator();

    var child = std.process.Child.init(&.{ "/bin/sh", "-c", curl_cmd }, proc_alloc);
    child.stdout_behavior = .Pipe;
    child.stderr_behavior = .Inherit;
    try child.spawn();

    var stdout_stream = child.stdout.?.reader();
    const output = try stdout_stream.readAllAlloc(proc_alloc, 10 * 1024);
    _ = try child.wait();

    r.setStatus(zap.http.StatusCode.ok);
    try r.setHeader("Content-Type", "application/json");
    try r.sendBody(output);
}

fn send_redirect(r: anytype, url: []const u8) !void {
    r.setStatus(zap.http.StatusCode.found);
    try r.setHeader("Location", url);
    try r.sendBody("");
}
