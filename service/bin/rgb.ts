#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { RgbStack } from '../lib/rgb-stack';
import { DailyChallengeStack } from '../lib/daily-challenge-stack';
const ENDPOINTS = require('./endpoints.json');

const account = process.env.CDK_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT;
const stage = process.env.CDK_STAGE || 'prod';
const app = new cdk.App();

// Multi-Region Deployment for Game Service
const regions = [
  'ap-southeast-2', // Australia
  'ap-northeast-1', // Japan
  'ap-southeast-1', // Singapore
  'ap-south-1', // India
  'eu-central-1', // Europe
  'eu-west-2', // UK
  'sa-east-1', // Brazil
  'us-east-1', // US East
  'us-west-2', // US West
]
regions.forEach((region) => {
  new RgbStack(app, `rgb-service-${stage}-${region}`, { 
    env: {
      account,
      region 
    },
    endpoints: ENDPOINTS
  });
});

// Deploy Daily Challenge Stack after game service (single region - central Europe for best global latency)
const dailyChallengeStack = new DailyChallengeStack(app, `rgb-daily-challenge-${stage}`, {
  env: {
    account,
    region: 'eu-central-1' // Frankfurt - optimal for global latency
  }
});

// Ensure daily challenge stack deploys after eu-central-1 game service stack
dailyChallengeStack.addDependency(app.node.findChild(`rgb-service-${stage}-eu-central-1`) as cdk.Stack);