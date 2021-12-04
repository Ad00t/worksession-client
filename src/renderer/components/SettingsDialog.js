import React, { useState } from 'react';

import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Radio from '@material-ui/core/Radio';

import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import FormLabel from '@material-ui/core/FormLabel';

import config from '../config/config';
import * as util from '../util/util';

import * as WorkSess from '../WorkSess';

export default function SettingsDialog({ open, setOpen, browser }) {
    const [devSettingsOpen, setDevSettingsOpen] = useState(false);
    const [passInput, setPassInput] = useState('');
    const [passFailed, setPassFailed] = useState(false);
    const [stageValue, setStageValue] = useState(config.get('stage'));
    const [loading, setLoading] = useState(false);

    function onDevPassSubmit(e) {
      e.preventDefault();
      const check = (passInput === 'bababooey03');
      setDevSettingsOpen(check);
      setPassFailed(!check);
      setPassInput('');
    }

    function handleClose() {
      setOpen(false);
      setPassInput('');
      setPassFailed(false);
    }

    async function handleStageChange(e) {
      setStageValue(e.target.value);
      config.set('stage', e.target.value);
      setLoading(true);
      WorkSess.clearClinicianInfo();
      await browser.loadURL(util.getStage().urlBase);
      setLoading(false);
    }

    return (
      <Dialog
        open={open}
        onClose={handleClose}
      >
        <DialogTitle style={{ textAlign: "center" }}>Settings</DialogTitle>
        <DialogContent>
          { (devSettingsOpen) ?
            <div
              style={{
                margin: '0.5em 1.5em',
                display: 'flex',
                flexFlow: 'row wrap',
                alignItems: 'left'
              }}
            >
              <FormControl component="fieldset">
                <FormLabel component="legend">Stage</FormLabel>
                <RadioGroup value={stageValue} onChange={handleStageChange}>
                  <FormControlLabel disabled={loading} value="dev" control={<Radio />} label="Dev" />
                  <FormControlLabel disabled={loading} value="staging" control={<Radio />} label="Staging" />
                  <FormControlLabel disabled={loading} value="prod" control={<Radio />} label="Prod" />
                </RadioGroup>
              </FormControl>
            </div>
            :
            <form
              onSubmit={onDevPassSubmit}
              noValidate
              autoComplete="off"
              style={{
                display: 'flex',
                flexFlow: 'row wrap',
                alignItems: 'center'
              }}
            >
              <TextField
                label="Developer Password"
                helperText={passFailed ? 'Incorrect password.' : 'Enter to access developer settings.'}
                error={passFailed}
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                style={{ marginLeft: '1.25em' }}
              >
                Submit
              </Button>
            </form>
          }
        </DialogContent>
      </Dialog>
    );
}
