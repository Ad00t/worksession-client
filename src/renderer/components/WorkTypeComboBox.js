import React, { useEffect } from 'react';

import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import TextField from '@material-ui/core/TextField';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';

import config from '../config/config';

export default function WorkTypeComboBox({ workType, setWorkType }) {
    const filter = createFilterOptions();
  
    return (
      <FormControl style={{ width: 300 }}>
        <InputLabel id="activityTypeLabel">Activity Type</InputLabel>
        <Select
          labelId="activityTypeLabel"
          id="activityTypeSelect"
          value={workType}
          onChange={(e) => setWorkType(e.target.value)}
        >
          {config.get('workTypes').map((wt, i) => (
            <MenuItem key={i} value={wt}>{wt}</MenuItem>
          ))}
        </Select>
      </FormControl>
    );
}