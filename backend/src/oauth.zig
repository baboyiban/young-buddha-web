const std = @import("std");
const zap = @import("zap");

const GOOGLE_CLIENT_ID = "574665261370-kijb3qoqaq6ka9vem42hvobqu0gmq9aj.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URI = "http://localhost:8080/auth/google/callback";
const GOOGLE_SCOPE = "openid%20email%20profile";

pub fn handle_oauth_google(r: zap.Request) !void {
    const url = try build_google_auth_url();
    try send_redirect(r, url);
}

fn build_google_auth_url() ![]u8 {
    return std.fmt.allocPrint(std.heap.page_allocator, "https://accounts.google.com/o/oauth2/v2/auth?client_id={s}&redirect_uri={s}&response_type=code&scope={s}&state={s}", .{ GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, GOOGLE_SCOPE, "random_state" });
}

pub fn handle_oauth_google_callback(r: zap.Request) !void {
    try send_redirect(r, "/");
}

fn send_redirect(r: zap.Request, url: []const u8) !void {
    r.setStatus(zap.http.StatusCode.found);
    try r.setHeader("Location", url);
    try r.sendBody("");
}
