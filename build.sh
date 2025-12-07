#!/bin/bash
set -e

echo "Building Go backend..."
go build -o app main.go

echo "Backend build complete!"
