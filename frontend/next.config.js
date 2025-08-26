/** @type {import('next').NextConfig} */

// 환경 변수에서 백엔드 URL 가져오기 (런타임에 결정)
const getBackendOrigin = () => {
  // 개발 환경에서는 localhost, 프로덕션에서는 백엔드 서비스 이름 사용
  if (process.env.NODE_ENV === "development") {
    return process.env.BACKEND_ORIGIN || "http://localhost:8080";
  }
  return process.env.BACKEND_ORIGIN || "http://backend:8080";
};

const nextConfig = {
  // Docker 친화적인 출력 (standalone)
  output: "standalone",

  // 이미지 최적화 설정
  images: {
    domains: ["lh3.googleusercontent.com"],
    unoptimized: process.env.NODE_ENV !== "production",
  },

  // API 리라이트 설정 (런타임 환경변수 사용)
  async rewrites() {
    const backendOrigin = getBackendOrigin();

    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${backendOrigin}/auth/:path*`,
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

// 개발 환경 설정
if (process.env.NODE_ENV === "development") {
  nextConfig.rewrites = async () => {
    const backendOrigin = getBackendOrigin();

    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${backendOrigin}/auth/:path*`,
      },
    ];
  };
}

module.exports = nextConfig;
