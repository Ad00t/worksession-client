const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const BoxSDK = require('box-node-sdk');
const crypto = require('crypto');

const boxConfig = require('../config/529616378_en3h9wn8_config.json');
const sdk = BoxSDK.getPreconfiguredInstance(boxConfig);
const client = sdk.getAppAuthClient('user', '16850231633');

// Connect to Box.com API & create folder
export async function initFolder(session, errors) {
    try {
        const existingId = await client.folders.getItems('142933730580', { fields: 'name', })
            .then(result => result.entries.filter(item => item.name === session.payload.worksession_id))
            .then(filtered => filtered.length > 0 ? filtered[0].id : null);
        if (existingId) {
            console.log('Deleting existing box.com folder');
            await client.folders.delete(existingId, { recursive: true });
        }
        return await client.folders.create('142933730580', session.payload.worksession_id);
    } catch (e) {
        errors.push('box-init-failed');
        console.error(e);
    }
}

// Upload file to Box.com folder, returns sharing link
export async function upload(folder, filePath, errors) {
    const fileName = path.basename(filePath);
    try {
        let fileObj;
        const accessToken = await client._session.getAccessToken(client._tokenOptions);
        const f = fs.readFileSync(filePath);
        if (f.length < 20000000) {
            const formData = new FormData();
            formData.append('attributes', JSON.stringify({
                name: fileName,
                parent: { id: folder.id }
            }));
            formData.append('file', new Blob([f]), fileName);

            fileObj = (await axios.post('https://upload.box.com/api/2.0/files/content', formData, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'content-md5': crypto.createHash('sha1').update(f).digest('hex')
                }
            })).data;
        } else {
            const uploader = await client.files.getChunkedUploader(folder.id, f.length, fileName, f);
            fileObj = await new Promise((resolve, reject) => {
                uploader.on('error', err => reject);
                uploader.on('chunkUploaded', part => { });
                uploader.on('uploadComplete', resolve);
                uploader.start();
            });
        }

        return (await client.files.update(fileObj.entries[0].id, {
            shared_link: { }
        })).shared_link.url;
    } catch (e) {
        errors.push(`box-upload-failed:${fileName}`);
        console.error(e);
    }
}
