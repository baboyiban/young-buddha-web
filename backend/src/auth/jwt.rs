use axum::http::HeaderMap;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use time::OffsetDateTime;
use crate::utils::cookie::CookieUtils;
use crate::types::{AppError, JwtClaims};

pub struct JwtService {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    expiry_seconds: i64,
}

impl JwtService {
    pub fn new(secret: String, expiry_seconds: i64) -> Self {
        let encoding_key = EncodingKey::from_secret(secret.as_bytes());
        let decoding_key = DecodingKey::from_secret(secret.as_bytes());

        Self {
            encoding_key,
            decoding_key,
            expiry_seconds,
        }
    }

    pub fn encode(&self, name: &str, email: &str, role: &str) -> Result<String, AppError> {
        let exp = OffsetDateTime::now_utc().unix_timestamp() + self.expiry_seconds;
        let claims = JwtClaims {
            name: name.to_string(),
            email: email.to_string(),
            role: role.to_string(),
            exp,
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(AppError::Jwt)
    }

    pub fn decode(&self, token: &str) -> Result<JwtClaims, AppError> {
        let token_data = decode::<JwtClaims>(
            token,
            &self.decoding_key,
            &Validation::default(),
        )?;

        Ok(token_data.claims)
    }

    pub fn extract_from_cookie(&self, headers: &HeaderMap) -> Option<String> {
        CookieUtils::extract_token_from_cookie(headers, "jwt")
    }

    pub fn extract_email_from_headers(&self, headers: &HeaderMap) -> Option<String> {
        let jwt_token = self.extract_from_cookie(headers)?;
        let claims = self.decode(&jwt_token).ok()?;
        Some(claims.email)
    }
}
