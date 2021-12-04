import React, { useEffect } from 'react';

import config from '../config/config';
import * as util from '../util/util';

const remote = require('@electron/remote');

const InfoPanelCanvas = React.forwardRef(({ isStarted, session }, ref) => {
    function draw(ctx) {
      // Background
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      if (isStarted) {
        ctx.fillStyle = 'white';
        var x = 10, y = 32;
        var ls1 = 24, ls2 = 18;
        ctx.font = "26px Arial";

        const clinNameSplit = session.clinicianName.split();
        const duration = Math.floor((new Date() - session.payload.start_time) / 1000);
        const { hours, minutes, seconds } = util.deconstructDuration(duration, false);
        const durationStr = util.deconstructDuration(duration, true);

        ctx.fillText(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`, x, y); y += ls1;

        ctx.font = "13px Arial";
        ctx.fillText(`Patient: ${session.patientName} (ID: ${session.payload.patient_ID})`, x, y); y += ls2;
        ctx.fillText(`Session ID: ${session.payload.worksession_id}`, x, y); y += ls2;
        ctx.fillText(`Activity Type: ${session.payload.work_type}`, x, y); y += ls2;
        ctx.fillText(`Care Manager: ${clinNameSplit[1]}, ${clinNameSplit[0]}`, x, y); y += ls2;
        ctx.fillText(`Work Performed By: ${session.clinicianName}`, x, y); y += ls2;
        ctx.fillText(`Started: ${util.toLS(session.payload.start_time, 'EDT').split(', ')[1]} EDT (${durationStr} ago)`, x, y);
      }
    }

    useEffect(() => {
      const context = ref.current.getContext('2d');
      context.canvas.hidden = true;
      let animationFrameId;
      function render() {
        draw(context);
        animationFrameId = window.requestAnimationFrame(render);
      }
      render();
      return () => {
        window.cancelAnimationFrame(animationFrameId);
      }
    }, [draw]);

    const { width, height } = remote.screen.getPrimaryDisplay().size;

    return (
      <canvas
        ref={ref}
        width={366}
        height={config.get('useWebcam') ? height - 206 : height}
      />
    );
});

export default InfoPanelCanvas;
