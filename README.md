This application is an AWS serverless app built using SAM, cloudformation, TypeScript, + mongoose.

## High Level Design
* The service includes a rule + permissions to run a lambda function each day.
* The lambda is provided with some config information + fetches its MongoDB connection string from Secrets Manager on deploy.
* The lambda calculates what day we are on in the workout program, based on a configurable start date.
* Our program operates on 10-week cycles, with the 5th and 10th days being rest days.
* If we are on a rest day, the lambda simply logs that it is a rest day.
* If we are on a workout day, the lambda queries my workout database (hosted on Mongo Atlas).
* The results of the workout are then formatted into a neat, slightly insulting message, which is pushed to an SNS topic, which ultimately pushes out to a list of email subscribers.
* There is a configurable offset value to be used if we ever de-sync. This will allow us to take an extra day off if needed.

## Running
Simply run `sam build; sam deploy` to send this to your AWS instance. Really, this note is just for me, since you would also need a MongoDB instance hosted with the same schema. Another prerequisite is that you must have a DB connection string secret configured.