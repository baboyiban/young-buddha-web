/** @type {import('next').NextConfig} */

// 환경 변수에서 백엔드 URL 가져오기 (빌드 시 결정)
// NOTE: Next의 rewrites는 빌드 시 구성되므로, 프로덕션 기본값을 backend 서비스로 둡니다.
const getBackendOrigin = () => {
  const fromEnv = process.env.BACKEND_INTERNAL_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv;
  const isProd = process.env.NODE_ENV === "production";
  return isProd ? "http://backend:8080" : "http://localhost:8080";
};

const nextConfig = {
  // Docker runner 단계에서 .next/standalone을 사용하기 위해 필요
  output: "standalone",

  // 이미지 최적화 설정
  images: {
    domains: ["lh3.googleusercontent.com"],
    unoptimized: process.env.NODE_ENV !== "production",
  },

  // 폰트 최적화 비활성화 (node-fetch 경고 해결)
  experimental: {
    optimizeCss: false,
  },

  // API 리라이트 설정
  async rewrites() {
    const backendOrigin = getBackendOrigin();

    return [
      // 모든 API 라우트 (인증 포함)
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },

  // 웹팩 설정
  webpack: (config, { isServer }) => {
    // 클라이언트 사이드에서 환경변수 접근 가능하도록 설정
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },

  // 컴파일러 설정
  compiler: {
    // 프로덕션에서만 제거
    removeConsole: process.env.NODE_ENV === "production",
  },

  // 트랜스파일 설정
  transpilePackages: ["@radix-ui/react-icons"],

  // 환경변수 노출
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "/api",
  },
};

// 개발 환경에서는 동일한 라우팅 규칙 사용

module.exports = nextConfig;
