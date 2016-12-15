/// <reference path="../../typings/index.d.ts" />

import {App} from './components/App';
import * as electron from 'electron';
import * as React from 'react'; // used below
import {render} from 'react-dom';


// Disallow zooming.
electron.webFrame.setZoomLevelLimits(1, 1);

render(<App/>, document.getElementById('outer-app-container'));
