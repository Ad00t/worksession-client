import React from 'react';

import Drawer from '@material-ui/core/Drawer';
import Box from '@material-ui/core/Box';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Divider from '@material-ui/core/Divider';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';

import * as util from '../util/util';

export default function SessionInProcessingDrawer({ open, setOpen, sessStack }) {
  return (
    <Drawer
      anchor={'right'}
      open={open}
      onClose={() => setOpen(false)}
    >
      <Box      
        sx={{ width: '425px' }}
        role="presentation"
      >
        <List>
          {(sessStack.length > 0) ?
            sessStack.map((session) => (
              <div key={session.payload.worksession_id}>
                <ListItem>
                  <ListItemText 
                    component={'div'}
                    primary={session.payload.worksession_id} 
                    secondary={
                      <div>
                        <LinearProgress component={'div'} variant="determinate" value={session.status.progress} />
                        <Typography component={'div'} variant="body2" color="textSecondary">
                          {`Status: ${session.status.text}`}
                        </Typography>
                        {(session.payload.start_time) &&
                          <div>
                            {`Started ${util.toLS(session.payload.start_time).split(', ')[1]}`}
                          </div>
                        }
                        {(session.payload.end_time) &&
                          <div>
                            <div>
                              {`Ended ${util.toLS(session.payload.end_time).split(', ')[1]}`}
                            </div>
                            <div>
                              {util.deconstructDuration(session.payload.duration, true)}
                            </div>
                          </div>
                        }
                      </div>
                    }
                  />
                </ListItem>
                <Divider />
              </div>
            ))
            :
            <Typography 
              variant="h5" 
              color="textSecondary"
              component={'div'}
              style={{
                margin: '37vh 5vw',
                textAlign: 'center'
              }}
            >
              Work sessions currently being recorded or processed will show up here.
            </Typography>
          }
        </List>
      </Box>
    </Drawer>
  );
}