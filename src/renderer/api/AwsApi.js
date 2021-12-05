import config from '../config/config';
import * as util from '../util/util';

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const AWS = require('aws-sdk');
const awsConfig = require('../config/awsConfig.json');
const s3 = new AWS.S3(awsConfig);

export function getStagePrefix() {
    let stage = config.get('stage');
    if (stage !== 'prod') stage += '.';
    else stage = '';
    return stage;
}

export async function getConfig(errors) {
    await s3.getObject({
        Bucket: 'assurehealthconfigs',
        Key: 'worksessionClientConfig.json',
        ResponseCacheControl: 'no-cache'
    }).promise()
        .then(res => {
            try {
                const configJSON = JSON.parse(res.Body.toString('utf-8'));
                console.log(configJSON);
                config.set('useWebcam', configJSON.useWebcam);
                config.set('workTypes', configJSON.workTypes);
                config.set('recordAllScreens', configJSON.recordAllScreens);
            } catch (err) {
                errors.push('config-parsing-failed');
                console.error(err);
            }
        })
        .catch(err => {
            errors.push('config-retrieval-error');
            console.error(err);
        });
}

export async function createWorksessionSf(session, errors) {
    await axios.post(`https://${getStagePrefix()}assurehealthplatform.com/ws-api/worksessions`, {
        ...session.payload,
        start_time: util.toLS(session.payload.start_time, 'GMT'),
        end_time: util.toLS(session.payload.end_time, 'GMT')
    })
        .then(res => console.log(res))
        .catch(err => {
            console.error(err.response);
            if (session.fromCache && err.response && err.response.data.message.includes('DUPLICATE_VALUE'))
                return;
            errors.push(`create-ws-failed`);
        });
}

export async function updateWorksessionSf(session, errors) {
    await axios.patch(`https://${getStagePrefix()}assurehealthplatform.com/ws-api/worksessions`, {
        worksession_id: session.payload.worksession_id,
        pdf_audit: session.payload.pdf_audit,
        video_audit: session.payload.video_audit
    })
        .then(res => console.log(res))
        .catch(err => {
            console.error(err.response);
            errors.push(`update-ws-failed`);
        });
}

export async function submitNotes(notesObj) {
    notesObj.id = uuidv4();
    return await axios.post(`https://${getStagePrefix()}assurehealthplatform.com/ws-api/notes`, notesObj)
        .then(res => console.log(res))
        .catch(err => {
            console.error(err.response);
            return 'notes-submission-failed';
        });
}
