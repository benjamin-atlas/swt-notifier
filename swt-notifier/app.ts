import mongoose from 'mongoose';
import TemplateModel from './models/template';
import VideoLinkModel from './models/videolink';
import * as AWS from 'aws-sdk';

const getExerciseListAggregatePipeline = (weekIndex: number, dayIndex: number) => [
    {
        $match: {
            title: 'PPL Hypertrophy',
        },
    },
    {
        $project: {
            desiredWeek: {
                $arrayElemAt: ['$program.weeks', weekIndex],
            },
        },
    },
    {
        $project: {
            desiredDay: {
                $arrayElemAt: ['$desiredWeek.days', dayIndex],
            },
        },
    },
];

const getVideoLinkAggregatePipeline = (workoutTitle: string) => [
    {
        $match: {
            aliases: {
                $in: [workoutTitle],
            },
        },
    },
    {
        $project: {
            link: {
                $arrayElemAt: ['$links', 0],
            },
        },
    },
];

export const lambdaHandler = async (): Promise<any> => {
    try {
        if (!process.env.START_DATE) {
            throw new Error('START_DATE is not set');
        }

        let offset: number = 0;
        if (process.env.OFFSET) {
            try {
                offset = parseInt(process.env.OFFSET);
            } catch (e) {
                console.log(`Error parsing OFFSET value [${process.env.OFFSET}]`, e);
            }
        }

        console.log('Days since start: ', daysSince(new Date(process.env.START_DATE)));

        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is not set');
        }

        const sns = new AWS.SNS();
        const topicArn = process.env.SNS_TOPIC_ARN;
        if (!topicArn) {
            throw new Error('SNS_TOPIC_ARN environment variable not set');
        }

        const daysSinceStartOfProgram = daysSince(new Date(process.env.START_DATE)) + offset;
        if (daysSinceStartOfProgram % 5 === 0) {
            console.log('Rest day today. Exiting...');
            return {
                statusCode: 200,
                body: 'Rest day today. Exiting...',
            };
        }

        const weekIndex = Math.floor(daysSinceStartOfProgram / 10); // 10 days per week for this program

        // We take a rest day on the 5th day and 10th day of the week cycle
        const dayIndex =
            daysSinceStartOfProgram % 10 <= 4 ? (daysSinceStartOfProgram % 10) - 1 : (daysSinceStartOfProgram % 10) - 2;

        console.log('Week Index: ', weekIndex);
        console.log('Day Index: ', dayIndex);

        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to Database');

        const result: any = await TemplateModel.aggregate(getExerciseListAggregatePipeline(weekIndex, dayIndex)).exec();

        for (const exercise of result[0].desiredDay.exercises) {
            exercise.videolink = await getVideoLink(exercise.workoutTitle);
        }

        const emailBody = result[0].desiredDay.exercises.reduce((acc: string, exercise: any) => {
            return (
                `${acc}` +
                `\n\n------------------------------------------------\n\n` +
                `${exercise.workoutTitle}\n\n` +
                `${exercise.workingSets}x${exercise.reps} @ RPE ${exercise.rpe}\n\n` +
                `${exercise.videolink}\n\n` +
                `Notes: ${exercise.notes}`
            );
        }, `Hey goofies, here's the reggie for the day.\n\n🏋🏻 ${result[0].desiredDay.title} 🥩`);

        const params: AWS.SNS.PublishInput = {
            Message: emailBody,
            TopicArn: topicArn,
        };

        await sns.publish(params).promise();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Success! Message published to SNS topic.',
            }),
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'some error happened',
            }),
        };
    }
};

const getVideoLink = async (workoutTitle: string): Promise<string> => {
    let link: string = '-';
    try {
        const result: any = await VideoLinkModel.aggregate(
            getVideoLinkAggregatePipeline(workoutTitle.toUpperCase()),
        ).exec();

        if (!result || !result[0]) {
            throw new Error('No video link found');
        }

        link = result[0].link;
    } catch (err) {
        console.log('Error getting video link', err);
    }

    return link;
};

const daysSince = (targetDate: Date): number => {
    const currentDate = new Date();
    const differenceMs = targetDate.getTime() - currentDate.getTime();
    const differenceDays = Math.floor(differenceMs / (1000 * 60 * 60 * 24));

    return differenceDays * -1;
};
