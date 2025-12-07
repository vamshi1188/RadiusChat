#!/bin/bash
set -e

echo "Building frontend..."
cd web
npm install
npm run build
cd ..

echo "Building Go backend..."
go build -o app main.go

echo "Build complete!"
