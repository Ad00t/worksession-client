const Store = require('electron-store');

const config = new Store({
  schema: {
    title: { type: 'string' },
    workTypes: {
      type: 'array',
      items: { type: 'string' }
    },
    useWebcam: { type: 'boolean' },
    recordAllScreens: { type: 'boolean' },
    stage: { type: 'string' },
    ffmpegPath: { type: 'string' },
    ffprobePath: { type: 'string' }
  },
  defaults: {
    title: '',
    workTypes: [
      'a',
      'b',
      'c',
      'Reviewing readings',
      'Phone call with patient',
      'Writing up notes'
    ],
    useWebcam: false,
    recordAllScreens: true,
    stage: 'prod',
    ffmpegPath: '',
    ffprobePath: ''
  }
});

const pjson = require('../../../package.json');
config.set('title', `${pjson.productName} v${pjson.version}`);

export default config;
