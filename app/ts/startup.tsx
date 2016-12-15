// tslint:disable:no-reference
/// <reference path="../../typings/index.d.ts" />
// tslint:enable:no-reference

import {App} from './components/App';
import * as electron from 'electron';
// tslint:disable:no-unused-variable
import * as React from 'react'; // used below
// tslint:enable:no-unused-variable
import {render} from 'react-dom';


// Disallow zooming.
electron.webFrame.setZoomLevelLimits(1, 1);

render(<App/>, document.getElementById('outer-app-container'));
