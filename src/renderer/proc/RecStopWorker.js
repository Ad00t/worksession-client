const fs = require('fs');
const path = require('path');
const child = require('child_process');

onmessage = e => {
    // Get params
    console.log('Get worker params');
    const { session, userDataPath, ffmpegPath } = e.data;
    const pSess = fileName => path.join(userDataPath, 'out', session.payload.worksession_id, fileName || '');

    // Convert to mp4
    console.log('Converting to mp4s');
    const mp4 = pSess('video.mp4');
    if (fs.existsSync(mp4))
        fs.unlinkSync(mp4);
    child.execFileSync(ffmpegPath, [ '-fflags', '+genpts', '-i', pSess('video.webm'), '-r', '25', mp4 ]);

    postMessage('');
}
