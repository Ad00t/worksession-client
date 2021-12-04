import React from 'react';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import IconButton from '@material-ui/core/IconButton';
import { Delete, Save } from '@material-ui/icons';

import useMediaQuery from '@material-ui/core/useMediaQuery';
import { useTheme } from '@material-ui/core/styles';

import * as util from '../util/util';

const fs = require('fs-extra');
const path = require('path');
const WorkSess = require('../WorkSess');

export default function CacheDialog({ open, setOpen, list, setList, setSessStackState, raiseError }) {
    return (
      <div>
        <Dialog
          fullScreen={useMediaQuery(useTheme().breakpoints.down('sm'))}
          open={open}
          aria-labelledby="dialog-title"
          onClose={(event, reason) => {
            if (reason !== 'backdropClick' && reason !== 'escapeKeyDown')
              onClose(event, reason);
          }}
        >
          <DialogTitle id="dialog-title">Cached Session(s) Found</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Cached session(s) were recovered. You must either 
              save or discard all of them to continue.
            </DialogContentText>
            <List>
              {list.map(session =>
                <CacheItem 
                  key={session.payload.worksession_id}
                  session={session}
                  list={list}
                  setList={setList}
                  setOpen={setOpen}
                  setSessStackState={setSessStackState}
                  raiseError={raiseError}
                />
              )}
            </List>
          </DialogContent>
        </Dialog>
      </div>
    );
}

function CacheItem({ session, list, setList, setOpen, setSessStackState, raiseError }) {
  function commonHandleEnd() {
    const newList = list.filter(fSession => fSession.payload.worksession_id !== session.payload.worksession_id);
    setList(newList);
    if (newList.length === 0)
      setOpen(false);
  }

  function handleSave() {
    console.log(`Saving ${session.payload.worksession_id}`);
    WorkSess.addSessionToStack(session);
    WorkSess.onStop(session)
      .then(({ errors }) => {
        setSessStackState(WorkSess.sessStack);
        if (errors.length !== 0)
          raiseError(`Encountered error(s) while processing worksession: ${errors.join(', ')}`);
      });
    commonHandleEnd();
  }

  function handleDiscard() {
    console.log(`Discarding ${session.payload.worksession_id}`);
    fs.removeSync(WorkSess.pSess(session));
    commonHandleEnd();
  }

  return (
    <ListItem>
      <ListItemText
        component={'div'}
        primary={session.payload.worksession_id}
        secondary={
          <div>
            <div>
              {`${util.toLS(session.payload.start_time).split(', ')[1]} to ${util.toLS(session.payload.end_time).split(', ')[1]}`}
            </div>
            <div>
              {util.deconstructDuration(session.payload.duration, true)}
            </div>
          </div>
        }
      />
      <ListItemSecondaryAction>
        <div>
          <IconButton edge="end" aria-label="save" onClick={handleSave} style={{ marginRight: '1em' }}><Save /></IconButton>
          <IconButton edge="end" aria-label="delete" onClick={handleDiscard} ><Delete /></IconButton>
        </div>
      </ListItemSecondaryAction>
    </ListItem>
  );

}