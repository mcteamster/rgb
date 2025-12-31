#!/bin/bash

echo "🎮 RGB Game Infrastructure Deployment"
echo "======================================"

# Build the project
echo "📦 Building CDK project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Deploy the stack
echo "🚀 Deploying to AWS..."
npx cdk deploy --require-approval never

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "Your RGB game infrastructure is now live!"
    echo "Check the outputs above for API endpoints."
else
    echo "❌ Deployment failed"
    exit 1
fi
