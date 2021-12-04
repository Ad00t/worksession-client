import React, { useState, useEffect, useRef } from 'react';

import TextareaAutosize from '@material-ui/core/TextareaAutosize';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';

import ChipInput from 'material-ui-chip-input'
import PuffLoader from "react-spinners/PuffLoader";
import * as colors from '@material-ui/core/colors';
import NotesWindow from './NotesWindow';

// Node
const remote = require('@electron/remote');
const fs = require('fs-extra');
const path = require('path');

const notesPath = path.join(remote.app.getPath('userData'), 'notes.json');

export default function NotesComponent({ setOpen, notesObj, setNotesObj, onSubmit }) {
  const [loading, setLoading] = useState(false);

  let saveString;
  useEffect(() => {
    let saveInterval = setInterval(() => {
      let json = JSON.stringify(notesObj);
      if (!saveString || json !== saveString) {
        fs.writeFileSync(notesPath, JSON.stringify(notesObj));
        saveString = json;
        console.log('Notes saved');
      }
    }, 1000);
    return () => clearInterval(saveInterval);
  }, [notesObj]);

  async function onSubmitPressed() {
    setLoading(true);
    await onSubmit();
    setLoading(false);
  }

  return (
    <NotesWindow
      onClose={() => {
        setOpen(false);
        remote.BrowserWindow.getAllWindows()[1].focus();
      }}
    >
      { (loading) ?
        <PuffLoader
          color={colors.purple[700]}
          css={'display: block; margin: 0 auto;'}
          loading={loading}
          size="6em"
        />
        :
        <Grid
          container
          spacing={1}
        >
          {/* Notes */}
          <Grid item xs={12}>
            <TextareaAutosize
              placeholder="Clinical notes"
              minRows={10}
              disabled={loading}
              style={{
                width: 'calc(100vw - 1.2em)',
                height: 'calc(100vh - 6em)',
                resize: 'none',
                fontFamily: 'sans-serif',
                position: 'absolute',
                top: '0.2em'
              }}
              value={notesObj.notes}
              onChange={(e) => setNotesObj({ ...notesObj, notes: e.target.value })}
            />
          </Grid>

          {/* Tags */}
          <Grid item>
            <ChipInput
              placeholder="Tags"
              disabled={loading}
              style={{
                position: 'absolute',
                bottom: '1.5em',
                left: '0.2em',
                width: '70vw'
              }}
              defaultValue={notesObj.tags}
              onChange={(chips) => setNotesObj({ ...notesObj, tags: chips })}
            />
          </Grid>

          {/* Submit Button */}
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              size="small"
              disabled={loading}
              style={{
                position: 'absolute',
                bottom: '1.5em',
                right: '0.2em'
              }}
              onClick={onSubmitPressed}
            >
              Submit
            </Button>
          </Grid>
        </Grid>
      }
    </NotesWindow>
  );
}
