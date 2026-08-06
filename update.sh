#!/bin/bash

set -e

echo "=================================="
echo "Starting deployment..."
echo "=================================="

echo "Pulling latest code..."
git pull --ff-only

echo "Stopping containers..."
docker compose down

echo "Building and starting containers..."
docker compose up --build -d

echo "=================================="
echo "Deployment completed successfully!"
echo "=================================="