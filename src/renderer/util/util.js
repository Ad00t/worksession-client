import config from '../config/config';

export function deconstructDuration(duration, asString) {
    const asObj = {
        hours: Math.floor(duration / 3600),
        minutes: Math.floor((duration % 3600) / 60),
        seconds: duration % 60
    };
    return asString ? `${asObj.hours} hr, ${asObj.minutes} min, ${asObj.seconds} sec` : asObj;
}

export function toLS(date, tz) {
    if (tz === 'EDT') tz = 'America/New_York';
    const options = tz ? { timeZone: tz } : {};
    return date.toLocaleString('en-US', options);
} 

const stageMap = {
    dev: {
      urlBase: 'https://assurehealth--hc.lightning.force.com'
    },
    staging: {
      urlBase: 'https://assurehealth--pc.lightning.force.com'
    },
    prod: {
      urlBase: 'https://assurehealth.lightning.force.com'
    }
}

export function getStage() {
    return stageMap[config.get('stage')];
}