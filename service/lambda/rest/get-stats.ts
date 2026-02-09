import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const CHALLENGES_TABLE = process.env.CHALLENGES_TABLE || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const challengeId = event.pathParameters?.challengeId;
        if (!challengeId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing challengeId' })
            };
        }

        // Get challenge metadata
        const challengeResult = await dynamodb.send(new GetCommand({
            TableName: CHALLENGES_TABLE,
            Key: { challengeId }
        }));

        if (!challengeResult.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Challenge not found' })
            };
        }

        const challenge = challengeResult.Item;
        const averageColor = challenge.averageColor || null;
        const totalSubmissions = challenge.totalSubmissions || 0;
        const componentStats = challenge.componentStats;

        if (totalSubmissions === 0) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    totalSubmissions: 0,
                    averageColor: null,
                    hue: null,
                    saturation: null,
                    lightness: null
                })
            };
        }

        // If no componentStats (legacy challenge), return null stats but keep totalSubmissions
        if (!componentStats) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    totalSubmissions,
                    averageColor,
                    hue: null,
                    saturation: null,
                    lightness: null
                })
            };
        }

        // Calculate standard deviation from stored variance (m2)
        const stdDev = (m2: number, n: number) => Math.sqrt(m2 / n);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                totalSubmissions,
                averageColor,
                hue: {
                    avg: componentStats.h.mean,
                    stdDev: stdDev(componentStats.h.m2, totalSubmissions)
                },
                saturation: {
                    avg: componentStats.s.mean,
                    stdDev: stdDev(componentStats.s.m2, totalSubmissions)
                },
                lightness: {
                    avg: componentStats.l.mean,
                    stdDev: stdDev(componentStats.l.m2, totalSubmissions)
                }
            })
        };
    } catch (error) {
        console.error('Error getting stats:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
