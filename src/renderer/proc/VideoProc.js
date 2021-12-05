import * as WorkSess from '../WorkSess';
import config from '../config/config';

const remote = require('@electron/remote');
const fs = require('fs-extra');
const path = require('path');
const child = require('child_process');
const VideoStreamMerger = require('video-stream-merger').VideoStreamMerger;

// Check ffmpeg  installation
try {
    console.log(child.execFileSync(config.get('ffmpegPath'), [ '-version' ]).toString().split('\n')[0]);
} catch (e) {
    console.error('ffmpeg not found: ' + e);
}

// Start streams & merger
export async function startStreams(session, errors, canvas) {
    try {
        const { width, height } = remote.screen.getPrimaryDisplay().size;

        const sDim = {
            x: 0,
            y: 0,
            width: width,
            height: height
        };
        const wDim = {
            x: sDim.width,
            y: 0,
            width: 366,
            height: 206
        };
        const iDim = {
            x: wDim.x,
            y: config.get('useWebcam') ? wDim.height : 0,
            width: wDim.width,
            height: config.get('useWebcam') ? sDim.height - wDim.height : sDim.height
        };

        const merger = new VideoStreamMerger();
        let totalWidth = sDim.width + wDim.width;
        if (totalWidth % 2 !== 0) totalWidth++;
        merger.setOutputSize(totalWidth, sDim.height);

        let screenStream;
        if (config.get('recordAllScreens')) {
            screenStream = await navigator.mediaDevices.getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop' }}, audio: false });
        } else {
            const winBounds = remote.getCurrentWindow().getBounds();
            if (winBounds.x >= -15) winBounds.x = 1;
            if (winBounds.y >= -15) winBounds.y = 1;
            const displayId = remote.screen.getDisplayNearestPoint({ x: winBounds.x, y: winBounds.y }).id || remote.screen.getPrimaryDisplay().id;
            const mainScreenId = (await remote.desktopCapturer.getSources({ types: ['screen'] })
                                                        .then(sources => sources.filter(source => source.display_id == displayId))
                                                        .then(filtered => filtered[0].id)) || 'screen:0:0';
            console.log(`Display ID: ${mainScreenId}`);
            screenStream = await navigator.mediaDevices.getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: mainScreenId }}, audio: false });
        }
        merger.addStream(screenStream, { ...sDim, index: 0, mute: true });

        const canvasStream = canvas.captureStream(25);
        merger.addStream(canvasStream, { ...iDim, index: 1, mute: true });

        let webcamStream;
        if (config.get('useWebcam')) {
            const webcams = await navigator.mediaDevices.enumerateDevices()
                .then(devices => devices.filter(device => device.kind === 'videoinput' && !device.label.toLowerCase().includes('virtual')));
            if (webcams.length > 0) {
                console.log(`Using webcam: ${webcams[0].label}`);
                webcamStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: webcams[0].deviceId }, audio: false });
                merger.addStream(webcamStream, { ...wDim, index: 2, mute: true });
            }
        }

        merger.start();

        let isStopped = false;
        let lastBlobWritten = false;
        const mergerRec = new MediaRecorder(merger.result, { mimeType: 'video/webm;codecs=vp9' });
        mergerRec.ondataavailable = e => {
            if (e.data && e.data.size > 0) {
                console.log('Rec data available');
                e.data.arrayBuffer().then(buffer => {
                    fs.outputFileSync(WorkSess.pSess(session, 'video.webm'), Buffer.from(buffer), { flag: 'a' });
                    session.payload.end_time = new Date();
                    session.payload.duration = Math.floor((session.payload.end_time - session.payload.start_time) / 1000);
                    fs.writeFile(WorkSess.pSess(session, 'session.json'), JSON.stringify(session));
                    if (isStopped) {
                        console.log('Event dispatched: lastBlobWritten');
                        mergerRec.dispatchEvent(new Event('lastBlobWritten'));
                        lastBlobWritten = true;
                    }
                });
            }
        }
        mergerRec.onstop = e => {
            try {
                isStopped = true;
                if (merger) {
                    console.log('Stopping merger stream');
                    merger.result.getTracks().forEach(track => track.stop());
                    merger.destroy();
                }
                if (screenStream) {
                    console.log('Stopping screen stream');
                    screenStream.getTracks().forEach(track => track.stop());
                }
                if (canvasStream) {
                    console.log('Stopping canvas stream');
                    canvasStream.getTracks().forEach(track => track.stop());
                }
                if (webcamStream) {
                    console.log('Stopping webcam stream');
                    webcamStream.getTracks().forEach(track => track.stop());
                }
                setTimeout(() => {
                    if (!lastBlobWritten) {
                        console.log('Event dispatched: lastBlobWritten');
                        mergerRec.dispatchEvent(new Event('lastBlobWritten'));
                        lastBlobWritten = true;
                    }
                }, 5000);
            } catch (ex) {
                errors.push('stream-stop-failed');
                console.error(ex);
            }
        }

        return mergerRec;
    } catch (e) {
        console.error(e);
        errors.push('cant-record-session');
    }
}

export function process(session, errors) {
    console.log(`Processing - ${session.payload.worksession_id}`);
    const workerSession = { ...session };
    delete workerSession.mergerRec;
    const worker = new Worker(new URL('./RecStopWorker.js', import.meta.url));
    worker.onmessage = e => {
        console.log('Event dispatched: processed');
        session.mergerRec.dispatchEvent(new Event('processed'));
    }
    worker.onerror = ex => {
        ex.preventDefault();
        errors.push('worker-error');
        console.error(ex);
    }
    worker.postMessage({
        session: workerSession,
        userDataPath: remote.app.getPath('userData'),
        ffmpegPath: config.get('ffmpegPath')
    });
    console.log('Worker created');
}

