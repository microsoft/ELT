// Alignment toolbar view.
// - Toolbar buttons for alignment.

import * as Actions from '../../actions/Actions';
import {remote} from 'electron';
import * as React from 'react';


export interface AlignmentToolbarViewProps {
    top: number;
    left: number;
    viewWidth: number;
    viewHeight: number;
}


export class AlignmentToolbarView extends React.Component<AlignmentToolbarViewProps, {}> {
    public refs: {
        [name: string]: Element
    };

    public render(): JSX.Element {
        return (
            <div className='labeling-toolbar-view' style={{
                position: 'absolute',
                top: this.props.top + 'px',
                left: this.props.left + 'px',
                width: this.props.viewWidth + 'px',
                height: this.props.viewHeight + 'px'
            }}>
                <button className='tbtn tbtn-l1' title='Load/replace the reference track' onClick={() => {
                    remote.dialog.showOpenDialog(
                        remote.BrowserWindow.getFocusedWindow(),
                        {
                            properties: ['openFile'],
                            filters: [
                                { name: 'WebM videos', extensions: ['webm'] },
                                { name: 'Other supported videos', extensions: ['mp4', 'mov'] }
                            ]
                        },
                        (fileNames: string[]) => {
                            if (fileNames && fileNames.length === 1) {
                                new Actions.CommonActions.LoadReferenceTrack(fileNames[0]).dispatch();
                            }
                        });
                } }><span className='glyphicon glyphicon-folder-open'></span>Load Reference Video...</button>
                {' '}
                <button className='tbtn tbtn-l1' title='Load a sensor track from collected data' onClick={() => {
                    remote.dialog.showOpenDialog(
                        remote.BrowserWindow.getFocusedWindow(),
                        {
                            properties: ['openFile'],
                            filters: [
                                { name: 'Sensor data', extensions: ['tsv'] },
                                { name: 'WebM videos', extensions: ['webm'] },
                                { name: 'Other supported videos', extensions: ['mp4', 'mov'] }
                            ]
                        },
                        (fileNames: string[]) => {
                            if (fileNames && fileNames.length === 1) {
                                if (fileNames[0].match(/\.tsv$/i)) {
                                    new Actions.CommonActions.LoadSensorTrack(fileNames[0]).dispatch();
                                }
                                if (fileNames[0].match(/\.(webm|mp4|mov)$/i)) {
                                    new Actions.CommonActions.LoadVideoTrack(fileNames[0]).dispatch();
                                }
                            }
                        });
                } }><span className='glyphicon glyphicon-folder-open'></span>Load Video or Sensor...</button>
                {' '}
                <span className='sep' />
                {' '}
                <button className='tbtn tbtn-l3' title='Zoom in'
                    onClick={ () => new Actions.CommonActions.ReferenceViewPanAndZoom(0, -0.2, 'center').dispatch() }>
                    <span className='glyphicon icon-only glyphicon-zoom-in'></span>
                </button>
                {' '}
                <button className='tbtn tbtn-l3' title='Zoom out'
                    onClick={ () => new Actions.CommonActions.ReferenceViewPanAndZoom(0, +0.2, 'center').dispatch() }>
                    <span className='glyphicon icon-only glyphicon-zoom-out'></span>
                </button>
                {' '}
                <span className='sep' />
                {' '}
                <button className='tbtn tbtn-l3' title='Go to the beginning'
                    onClick={ () => new Actions.CommonActions.ReferenceViewPanAndZoom(-1e10, 0).dispatch() }>
                    <span className='glyphicon icon-only glyphicon-fast-backward'></span>
                </button>
                {' '}
                <button className='tbtn tbtn-l3' title='Go to the previous page'
                    onClick={ () => new Actions.CommonActions.ReferenceViewPanAndZoom(-0.6, 0).dispatch() }>
                    <span className='glyphicon icon-only glyphicon-backward'></span>
                </button>
                {' '}
                <button className='tbtn tbtn-l3' title='Go to the next page'
                    onClick={ () => new Actions.CommonActions.ReferenceViewPanAndZoom(+0.6, 0).dispatch() }>
                    <span className='glyphicon icon-only glyphicon-forward'></span>
                </button>
                {' '}
                <button className='tbtn tbtn-l3' title='Go to the end'
                    onClick={ () => new Actions.CommonActions.ReferenceViewPanAndZoom(+1e10, 0).dispatch() }>
                    <span className='glyphicon icon-only glyphicon-fast-forward'></span>
                </button>
            </div>
        );
    }
}
