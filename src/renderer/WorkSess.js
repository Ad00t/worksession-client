import * as BoxApi from './api/BoxApi';
import * as AwsApi from './api/AwsApi';
import * as VideoProc from './proc/VideoProc';
import * as PDFGen from './proc/PDFGen';

import * as util from './util/util';
import config from './config/config';

const remote = require('@electron/remote');
const fs = require('fs-extra');
const path = require('path');
const publicIp = require('public-ip');
const randomstring = require('randomstring');

// Session stack
export const sessStack = [];
const getCurrSess = () => sessStack[sessStack.length - 1];
var cachedSessions = [];

// Filepath calculations
export function pOut(id) {
    return path.join(remote.app.getPath('userData'), 'out', id || '');
}
export function pSess(session, fileName) {
    if (arguments && arguments.length === 1) {
        if (typeof arguments[0] === 'string') { fileName = arguments[0]; session = null; }
        else { session = arguments[0]; fileName = null; }
    }
    return path.join(pOut((session || getCurrSess()).payload.worksession_id), fileName || '');
}

// Change status of session, with cb to change state
var statusCb = (sessStack) => {}
function setStatus(session, text, dProg) {
    session.status = { text: text, progress: session.status.progress + dProg };
    statusCb(sessStack);
}
export function setStatusCb(cb) {
    statusCb = cb;
}

// Retrieve cached sessions
export function getCachedSessions() {
    let cachedSessions = [];
    if (fs.existsSync(pOut())) {
        try {
            cachedSessions = fs.readdirSync(pOut(), { withFileTypes: true })
                               .filter(dirent => dirent.isDirectory())
                               .map(dirent => dirent.name)
                               .filter(fN => !sessStack.map(sess => sess.payload.worksession_id).includes(fN))
                               .map(id => {
                                    let sessJson = path.join(pOut(id), 'session.json');
                                    if (fs.existsSync(sessJson)) {
                                        let parsed = JSON.parse(fs.readFileSync(sessJson));
                                        parsed.fromCache = true;
                                        parsed.payload.start_time = new Date(parsed.payload.start_time);
                                        parsed.payload.end_time = new Date(parsed.payload.end_time);
                                        parsed.mergerRec = new MediaRecorder(new MediaStream(), { mimeType: 'video/webm;codecs=vp9' })
                                        console.log(parsed);
                                        return parsed;
                                    }
                                    fs.removeSync(pOut(id));
                                    return null;
                                })
                                .filter(sess => sess);
        } catch (err) {
            console.error(err);
        }
    }
    console.log('Cached sessions:');
    console.log(cachedSessions);
    return cachedSessions;
}

// When timer starts
export async function onStart(workType, browser, canvas) {
    // Reset
    console.log('onStart');
    let errors = [];
    await AwsApi.getConfig(errors);
    let currSess = await addSessionToStack();

    // Get new session basic information
    try {
        console.log('New session');
        currSess.payload.worksession_id = randomstring.generate(16);
        currSess.patientName = browser.getTitle();
        currSess.patientName = currSess.patientName.substring(0, currSess.patientName.indexOf('|')).trim();
        currSess.payload.patient_ID = browser.getURL().split('/')[6];
        console.log(`Patient ID: ${currSess.payload.patient_ID}`);
        currSess.payload.work_type = workType;
    } catch (e) {
        errors.push('basic-info-not-found');
        console.error(e);
    }

    // Get clinician name & email
    await getClinicianInfo(browser);
    if ('name' in clinicianInfo && 'email' in clinicianInfo) {
        currSess.clinicianName = clinicianInfo.name;
        currSess.payload.clinician_email = clinicianInfo.email;
        console.log(`Clinician: ${currSess.clinicianName} (${currSess.payload.clinician_email})`);
    } else {
        errors.push('clinician-not-found');
    }

    // Start streams & recording
    try {
        if (errors.length === 0) {
            currSess.mergerRec = await VideoProc.startStreams(currSess, errors, canvas);
            console.log('mergerRec created');
        }
        if (errors.length === 0) {
            if (currSess.mergerRec) {
                currSess.mergerRec.start(1000);
                console.log('mergerRec started');
            }

            // Write session to cache
            currSess.payload.start_time = new Date();
            currSess.payload.end_time = new Date();
            fs.mkdirSync(pSess(), { recursive: true });
            fs.writeFileSync(pSess('session.json'), JSON.stringify(currSess));
            console.log('Session written to cache');
        }
    } catch (e) {
        errors.push('couldnt-start-recording');
        console.error(e);
    }

    // Wrap up start sequence
    if (errors.length > 0)
        removeSess(true);
    console.log('Session stack:');
    console.log(sessStack);
    console.log(errors);
    return { errors, session: currSess };
}

// Clinician info
export const clinicianInfo = {};
export function clearClinicianInfo() {
    if ('id' in clinicianInfo)
        delete clinicianInfo['id'];
    if ('name' in clinicianInfo)
        delete clinicianInfo['name'];
    if ('email' in clinicianInfo)
        delete clinicianInfo['email'];
}
export function getClinicianInfo(browser) {
    try {
        if (!('name' in clinicianInfo && 'email' in clinicianInfo && 'id' in clinicianInfo)) {
            let href = '';
            return new Promise(resolve => {
                setTimeout(async () => {
                    let errors = [];
                    let priorURL = browser.getURL();

                    await browser.executeJavaScript('document.querySelector("button.branding-userProfile-button").click();');
                    let start = Date.now();
                    while (href === '' && (Date.now() - start) <= 8500) {
                        href = await browser.executeJavaScript(`
                            (() => {
                                try {
                                    let a = document.querySelector("div.profile-card-indent > h1 > a");
                                    if (a && a.href && a.href !== "javascript:void(0);") return a.href;
                                } catch (err) {
                                    console.log(err);
                                }
                                return "";
                            })();
                        `);
                    }

                    if (href !== '' && href !== 'javascript:void(0);') {
                        let sfId18 = href.split('/')[6];
                        console.log(`Href: ${href} | sfId18: ${sfId18}`);
                        clinicianInfo.id = sfId18.substring(0, 15);
                        await browser.loadURL(`${util.getStage().urlBase}/${clinicianInfo.id}?noredirect=1&isUserEntityOverride=1`);
                        clinicianInfo.name = await browser.executeJavaScript('document.querySelector("#ep > div.pbBody > div.pbSubsection > table > tbody > tr:nth-child(1) > td.dataCol.col02").textContent;');
                        clinicianInfo.email = await browser.executeJavaScript('document.querySelector("#ep > div.pbBody > div.pbSubsection > table > tbody > tr:nth-child(3) > td.dataCol.col02 > a").textContent;');
                        console.log(`Retrieved Clinician: ${clinicianInfo.name} (${clinicianInfo.email} - ${clinicianInfo.id})`);
                        await browser.loadURL(priorURL);
                    } else {
                        console.log(`href invalid: ${href}`);
                    }

                    if (!('name' in clinicianInfo || 'email' in clinicianInfo || 'id' in clinicianInfo))
                        errors.push('clinician-retrieval-failed');
                    resolve(errors);
                }, 3000);
            });
        }
    } catch (err) {
        console.log(err);
    }
}

// When timer stopped
export function onStop(session) {
    // onStop
    let errors = [];
    let sessInProc = session || getCurrSess();
    console.log(`onStop - ${sessInProc.payload.worksession_id}`);

    setStatus(sessInProc, 'Creating mp4', 10);
    return new Promise((resolve, reject) => {
        sessInProc.mergerRec.addEventListener('lastBlobWritten', () => {
            console.log('Event received: lastBlobWritten');
            if (sessInProc.payload.duration <= 1) {
                errors.push('session-too-short');
                resolve();
            } else {
                sessInProc.mergerRec.addEventListener('processed', async (e) => {
                    console.log('Event recieved: processed');

                    // Create worksession in salesforce
                    console.log('Creating worksession in salesforce');
                    console.log(sessInProc);
                    setStatus(sessInProc, 'Creating worksession in salesforce', 25);
                    await AwsApi.createWorksessionSf(sessInProc, errors);

                    // Create folder in box.com, deleting if it already exists
                    console.log('Creating box.com folder');
                    setStatus(sessInProc, 'Creating box.com folder', 5);
                    let folder = await BoxApi.initFolder(sessInProc, errors);

                    // Upload video audit to box.com folder
                    console.log('Uploading video audit');
                    setStatus(sessInProc, 'Uploading video to box.com', 10);
                    sessInProc.payload.video_audit = (await BoxApi.upload(folder, pSess(sessInProc, 'video.mp4'), errors)) || '';

                    // Generate audit PDF
                    console.log('Generating pdf audit');
                    setStatus(sessInProc, 'Generating audit log PDF', 10);
                    await PDFGen.genAuditLog(sessInProc, errors);

                    // Upload audit PDF to box.com folder
                    console.log('Uploading pdf audit');
                    setStatus(sessInProc, 'Uploading audit log to box.com', 5);
                    sessInProc.payload.pdf_audit = (await BoxApi.upload(folder, pSess(sessInProc, 'audit.pdf'), errors)) || '';

                    // Update worksession in salesforce
                    console.log('Updating worksession in salesforce');
                    setStatus(sessInProc, 'Creating worksession in salesforce', 5);
                    await AwsApi.updateWorksessionSf(sessInProc, errors);
                    resolve();
                });
                VideoProc.process(sessInProc, errors);
            }
        });
        // VideoProc.js stop code
        if (session) {
            console.log('Event dispatched: lastBlobWritten');
            sessInProc.mergerRec.dispatchEvent(new Event('lastBlobWritten'));
        } else {
            sessInProc.mergerRec.stop();
        }
    })
    .then(() => {
        // Wrap up stop sequence
        console.log(`onStop wrap up - ${sessInProc.payload.worksession_id}`);
        setStatus(sessInProc, 'Done', 100 - sessInProc.status.progress);
        console.log(errors);
        return new Promise(resolve => {
            setTimeout(() => {
                removeSess(sessInProc, errors.length === 0 || errors[0] === 'session-too-short');
                resolve({ errors });
            }, errors[0] === 'session-too-short' ? 1000 : 0);
        });
    });
}

// Push new blank session to top of stack
export async function addSessionToStack(session) {
    sessStack.push((session || {
        patientName: '',
        clinicianName: '',
        fromCache: false,
        payload: {
            worksession_id: '',
            start_time: null,
            end_time: null,
            duration: -1,
            patient_ID: '',
            clinician_email: '',
            work_type: '',
            log_method: config.get('title'),
            clinician_IP: (await publicIp.v4()),
            pdf_audit: '',
            video_audit: ''
        },
        status: {
            text: 'Recording',
            progress: 0,
        }
    }));
    return getCurrSess();
}

// Remove session from session stack and out folder, defaults to currSess
function removeSess(session, shouldRemoveFolder) {
    if (arguments && arguments.length === 1) {
        shouldRemoveFolder = arguments[0];
        session = null;
    }
    let toRemove = session || getCurrSess();
    let i = sessStack.map(sess => sess.payload.worksession_id).indexOf(toRemove.payload.worksession_id);
    sessStack.splice(i, 1);
    if (shouldRemoveFolder) {
        fs.removeSync(pSess(toRemove));
        console.log('Removed session folder');
    }
}
