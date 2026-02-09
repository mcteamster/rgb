import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});
const ANALYTICS_BUCKET = process.env.ANALYTICS_BUCKET || '';

interface SubmissionRecord {
    userId: string;
    challengeId: string;
    userName: string;
    submittedColor: {
        h: number;
        s: number;
        l: number;
    };
    submittedAt: string;
    score: number;
    distanceFromAverage: number;
    fingerprint?: string;
}

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
    console.log(`Processing ${event.Records.length} records`);

    // Filter for INSERT events only
    const newSubmissions = event.Records
        .filter(record => record.eventName === 'INSERT' && record.dynamodb?.NewImage)
        .map(record => unmarshall(record));

    if (newSubmissions.length === 0) {
        console.log('No new submissions to process');
        return;
    }

    // Group by date for partitioning
    const submissionsByDate = groupByDate(newSubmissions);

    // Write each date partition to S3
    for (const [date, submissions] of Object.entries(submissionsByDate)) {
        await writeToS3(date, submissions);
    }

    console.log(`Successfully processed ${newSubmissions.length} submissions`);
};

function unmarshall(record: DynamoDBRecord): SubmissionRecord {
    const image = record.dynamodb!.NewImage!;
    
    return {
        userId: image.userId?.S || '',
        challengeId: image.challengeId?.S || '',
        userName: image.userName?.S || 'Anonymous',
        submittedColor: {
            h: Number(image.submittedColor?.M?.h?.N || 0),
            s: Number(image.submittedColor?.M?.s?.N || 0),
            l: Number(image.submittedColor?.M?.l?.N || 0)
        },
        submittedAt: image.submittedAt?.S || '',
        score: Number(image.score?.N || 0),
        distanceFromAverage: Number(image.distanceFromAverage?.N || 0),
        fingerprint: image.fingerprint?.S
    };
}

function groupByDate(submissions: SubmissionRecord[]): Record<string, SubmissionRecord[]> {
    const grouped: Record<string, SubmissionRecord[]> = {};
    
    for (const submission of submissions) {
        const date = submission.challengeId; // challengeId is the date (YYYY-MM-DD)
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(submission);
    }
    
    return grouped;
}

async function writeToS3(date: string, submissions: SubmissionRecord[]): Promise<void> {
    const [year, month, day] = date.split('-');
    const timestamp = Date.now();
    
    // Write as newline-delimited JSON (easier to convert to Parquet later)
    const ndjson = submissions.map(s => JSON.stringify(s)).join('\n');
    
    const key = `submissions/year=${year}/month=${month}/day=${day}/${timestamp}.json`;
    
    await s3Client.send(new PutObjectCommand({
        Bucket: ANALYTICS_BUCKET,
        Key: key,
        Body: ndjson,
        ContentType: 'application/x-ndjson'
    }));
    
    console.log(`Wrote ${submissions.length} submissions to s3://${ANALYTICS_BUCKET}/${key}`);
}
