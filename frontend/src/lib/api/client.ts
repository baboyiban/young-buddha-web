import ky from "ky";
import { API_URL } from "@/lib/config/api";
import { getCsrfTokenFromCookie } from "@/lib/csrf";

const NON_MUTATING_METHODS = ["get", "head", "options"];

export const apiClient = ky.create({
  prefixUrl: API_URL,
  credentials: "include",
  hooks: {
    beforeRequest: [
      (request) => {
        if (!NON_MUTATING_METHODS.includes(request.method.toLowerCase())) {
          const csrfToken = getCsrfTokenFromCookie();
          if (csrfToken) {
            request.headers.set("X-CSRF-Token", csrfToken);
          }
        }
      },
    ],
  },
});
