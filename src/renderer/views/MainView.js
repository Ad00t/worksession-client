import React, { useState, useEffect, useRef } from 'react';

// @material-ui/core
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Grid from '@material-ui/core/Grid';
import Snackbar from '@material-ui/core/Snackbar';
import MuiAlert from '@material-ui/lab/Alert';

// Other core
import Timer from 'react-compound-timer';
import * as WorkSess from '../WorkSess';

// Components
import WebView from '../components/webview/WebView';
import SessionInProcessingDrawer from '../components/SessionInProcessingDrawer';
import InfoPanelCanvas from '../components/InfoPanelCanvas';
import WorkTypeComboBox from '../components/WorkTypeComboBox';
import CacheDialog from '../components/CacheDialog';
import SettingsDialog from '../components/SettingsDialog';
import NotesComponent from '../components/notes/NotesComponent';

// @material-ui/icons
import PlayArrow from '@material-ui/icons/PlayArrow';
import Stop from '@material-ui/icons/Stop';
import Menu from '@material-ui/icons/Menu';
import Settings from '@material-ui/icons/Settings';
import Description from '@material-ui/icons/Description';

// Aesthetics
import * as colors from '@material-ui/core/colors';
import PuffLoader from "react-spinners/PuffLoader";

// Misc.
import config from '../config/config';
import * as util from '../util/util';
import * as AwsApi from '../api/AwsApi';

// Node
const remote = require('@electron/remote');
const fs = require('fs-extra');
const path = require('path');

var startTimer = () => {};
var stopTimer = () => {};
var resetTimer = () => {};

const emptyNotesObj = {
  patientID: '',
  notes: '',
  tags: [],
  isInWorksession: false,
  worksessionID: '',
  appointment: 'Appointment',
  clinicianID: ''
};

export default function MainView({}) {
  const [isStarted, setIsStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [workType, setWorkType] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionState, setSessionState] = useState({});
  const [sessStackState, setSessStackState] = useState([]);
  const [cachedSessions, setCachedSessions] = useState([]);

  const [cacheOpen, setCacheOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesObj, setNotesObj] = useState(emptyNotesObj);

  const browserRef = useRef();
  const canvasRef = useRef();

  useEffect(() => {
    WorkSess.setStatusCb((sessStack) => { setSessStackState([ ...sessStack ]); });
    return () => WorkSess.setStatusCb((sessStack) => { });
  }, []);

  useEffect(() => {
    async function onBrowserURLChange() {
      console.log(`New URL: ${browserRef.current.getURL()}`);
      if (browserRef.current.getURL() === `${util.getStage().urlBase}/one/one.app`) {
        setLoading(true);
        let errors = await WorkSess.getClinicianInfo(browserRef.current);
        if (errors && errors.length !== 0)
          raiseError('Could not retrieve clinician info. Please try again.');
        setLoading(false);
      }
    }

    if (browserRef && browserRef.current && browserRef.current.view) {
      console.log(browserRef.current);
      browserRef.current.view.addEventListener('did-finish-load', onBrowserURLChange);
      return () => browserRef.current.view.removeEventListener('did-finish-load', onBrowserURLChange);
    }
  }, []);

  function checkCache() {
    const cachedSesses = WorkSess.getCachedSessions();
    if (cachedSesses.length > 0) {
      setCachedSessions(cachedSesses);
      setCacheOpen(true);
      return true;
    }
    return false;
  }

  useEffect(checkCache, []);

  const notesPath = path.join(remote.app.getPath('userData'), 'notes.json');
  useEffect(() => {
    try {
      if (!fs.existsSync(notesPath))
        fs.writeFileSync(notesPath, JSON.stringify(emptyNotesObj));
      setNotesObj(JSON.parse(fs.readFileSync(notesPath)));
    } catch (err) {
      console.log(err);
    }
  }, []);

  function raiseError(msg) {
    const split = msg.split(' ');
    let wc = 0;
    for (let i = 0; i < split.length; i++) {
      if (wc++ === 10) {
        split.splice(i, 0, '\n');
        wc = 0;
      }
    }
    setErrorMsg(split.join(' '));
  }

  function setTimerMethods(start, stop, reset) {
    startTimer = () => start();
    stopTimer = () => stop();
    resetTimer = () => reset();
  }

  async function toggleWorkSess() {
    raiseError('');
    if (isStarted) { // STOP
      WorkSess.onStop(null)
        .then(({ errors }) => {
          setSessStackState(WorkSess.sessStack);
          if (errors.length !== 0)
            raiseError(`Encountered error(s) while processing worksession: ${errors.join(', ')}`);
        });
      stopTimer();
      setIsStarted(false);
      resetTimer();
    } else { // START
      if (browserRef.current.getURL().startsWith(`${util.getStage().urlBase}/lightning/r/Account/`)) {
        if (workType !== '') {
          if (checkCache())
            return;
          setLoading(true);
          const { errors, session } = await WorkSess.onStart(workType, browserRef.current, canvasRef.current);
          setLoading(false);
          setSessStackState(WorkSess.sessStack);
          setSessionState(session);
          if (errors.length === 0) {
            startTimer();
            setIsStarted(true);
          } else {
            raiseError(`Encountered error(s) while starting worksession: ${errors.join(', ')}`);
          }
        } else {
          raiseError('You must select an activity type to start a worksession.');
        }
      } else {
        raiseError('A work session may only be started on a patient account page. Please navigate to one.');
      }
    }
  }

  async function onNotesSubmit() {
    if (notesObj.notes === '') {
      raiseError('You must enter something into the notes field to submit.');
      return;
    }
    let toSubmit = { ...notesObj };

    if (isStarted) {
      toSubmit.isInWorksession = true;
      toSubmit.worksessionID = sessionState.payload.worksession_id;
      toSubmit.patientID = sessionState.payload.patient_ID;
    } else {
      let patientID = '';
      const url = browserRef.current.getURL();
      if (url.startsWith(`${util.getStage().urlBase}/lightning/r/Account/`)) {
        patientID = url.split('/')[6];
      } else {
        raiseError('You must either start a worksession or navigate to a patient account page to submit notes.');
        return;
      }
      toSubmit.isInWorksession = false;
      toSubmit.worksessionID = '';
      toSubmit.patientID = patientID;
    }

    if ('id' in WorkSess.clinicianInfo) {
      toSubmit.clinicianID = WorkSess.clinicianInfo.id;
    } else {
      raiseError('You must be signed into salesforce to submit notes.');
      return;
    }

    let error = await AwsApi.submitNotes(toSubmit);
    if (error) {
      raiseError(`Notes submission failed: ${error}`);
      return;
    }

    let tags = toSubmit.tags;
    setNotesObj({ ...emptyNotesObj, tags });
  }

  return (
    <div>
      <AppBar color="default">
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            margin: 'auto',
            padding: '0.75em 0',
          }}
        >
          <Toolbar>
            <Timer startImmediately={false}>
              {({ start, resume, pause, stop, reset, timerState }) => (
                <React.Fragment>
                  <Grid
                    container
                    direction="row"
                    justifyContent="center"
                    alignItems="center"
                    spacing={4}
                  >

                    <Grid item>
                      <Snackbar
                        open={errorMsg !== ''}
                        onClose={() => { raiseError(''); }}
                        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                        key="topleft"
                      >
                        <MuiAlert
                          elevation={6}
                          variant="filled"
                          onClose={() => { raiseError(''); }}
                          severity="error"
                          style={{ whiteSpace: 'pre-line' }}
                        >
                          { errorMsg }
                        </MuiAlert>
                      </Snackbar>
                    </Grid>

                    <Grid item>
                      <div style={{ fontSize: 30 }}>
                        <Timer.Hours />h <Timer.Minutes />m <Timer.Seconds />s
                      </div>
                    </Grid>

                    <Grid item>
                      <IconButton
                        variant="contained"
                        style={{ backgroundColor: (isStarted ? colors.red[400] : colors.green[400]) }}
                        onClick={async () => {
                          setTimerMethods(start, stop, reset);
                          await toggleWorkSess();
                        }}
                        disabled={loading}
                      >
                        { isStarted ? <Stop /> : <PlayArrow /> }
                      </IconButton>
                    </Grid>

                    <Grid item>
                      <WorkTypeComboBox workType={workType} setWorkType={setWorkType} />
                    </Grid>

                    <Grid item>
                      <IconButton onClick={() => setSettingsOpen(true)}>
                        <Settings />
                      </IconButton>
                      <SettingsDialog
                        open={settingsOpen}
                        setOpen={setSettingsOpen}
                        browser={browserRef.current}
                        sessions={sessStackState}
                      />
                    </Grid>

                    <Grid item>
                      <IconButton onClick={() => setNotesOpen(true)}>
                        <Description />
                      </IconButton>
                      { (notesOpen) &&
                        <NotesComponent
                          setOpen={setNotesOpen}
                          notesObj={notesObj}
                          setNotesObj={setNotesObj}
                          onSubmit={onNotesSubmit}
                        />
                      }
                    </Grid>

                    <Grid item>
                      <IconButton
                        variant="contained"
                        onClick={() => setSessionsOpen(!sessionsOpen)}
                      >
                        <Menu />
                      </IconButton>
                    </Grid>

                  </Grid>
                </React.Fragment>
              )}
            </Timer>
          </Toolbar>
        </div>
      </AppBar>
      <PuffLoader
        color={colors.purple[700]}
        css={'display: block; margin: 0 auto;'}
        loading={true}
        size="6em"
      />
      <CacheDialog
        open={cacheOpen}
        setOpen={setCacheOpen}
        list={cachedSessions}
        setList={setCachedSessions}
        setSessStackState={setSessStackState}
        raiseError={raiseError}
      />
      <WebView
        src={util.getStage().urlBase}
        style={{
          display: (loading ? 'none' : 'grid'),
          position: 'absolute',
          left: '-8px',
          top: '85px',
          width: '100vw',
          height: 'calc(100% - 93px)'
        }}
        ref={browserRef}
        allowpopups
        plugins
      />
      <InfoPanelCanvas
        isStarted={isStarted}
        session={sessionState}
        ref={canvasRef}
      />
      <SessionInProcessingDrawer
        open={sessionsOpen}
        setOpen={setSessionsOpen}
        sessStack={sessStackState}
      />
    </div>
  );
}
