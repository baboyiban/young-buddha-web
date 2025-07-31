#!/bin/bash

echo "=== Environment Variables Check ==="
echo "GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-'NOT SET'}"
echo "GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-'NOT SET'}"  
echo "GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI:-'NOT SET'}"
echo "JWT_SECRET: ${JWT_SECRET:-'NOT SET'}"
echo ""

if [ -f ".env" ]; then
    echo "=== .env file contents ==="
    cat .env
else
    echo "No .env file found"
fi