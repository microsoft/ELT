import {ActionBase} from '../actions/ActionBase';
import * as flux from 'flux';

export const globalDispatcher = new flux.Dispatcher<ActionBase>();
