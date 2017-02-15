import { projectUiStore } from '../../stores/stores';
import { observer } from 'mobx-react';
import * as React from 'react';

@observer
export class ReferenceVideoToolbar extends React.Component<{}, {}> {
    public render(): JSX.Element {
        return (
            <span className='btn-group pull-right'>
                <button className='tbtn tbtn-l3' title='Zoom in'
                    onClick={() => {
                        projectUiStore.zoomReferenceTrack(-0.2, 'center');
                    }}>
                    <span className='glyphicon icon-only glyphicon-zoom-in'></span>
                </button>
                <button className='tbtn tbtn-l3' title='Zoom out'
                    onClick={() => {
                        projectUiStore.zoomReferenceTrack(+0.2, 'center');
                    }}>
                    <span className='glyphicon icon-only glyphicon-zoom-out'></span>
                </button>
                <span className='sep' />
                <button className='tbtn tbtn-l3' title='Go to the beginning'
                    onClick={() => {
                        projectUiStore.zoomReferenceTrackByPercentage(-1e10);
                    }}>
                    <span className='glyphicon icon-only glyphicon-fast-backward'></span>
                </button>
                <button className='tbtn tbtn-l3' title='Go to the previous page'
                    onClick={() => {
                        projectUiStore.zoomReferenceTrackByPercentage(-0.6);
                    }}>
                    <span className='glyphicon icon-only glyphicon-backward'></span>
                </button>
                <button className='tbtn tbtn-l3' title='Go to the next page'
                    onClick={() => {
                        projectUiStore.zoomReferenceTrackByPercentage(+0.6);
                    }}>
                    <span className='glyphicon icon-only glyphicon-forward'></span>
                </button>
                <button className='tbtn tbtn-l3' title='Go to the end'
                    onClick={() => {
                        projectUiStore.zoomReferenceTrackByPercentage(+1e10);
                    }}>
                    <span className='glyphicon icon-only glyphicon-fast-forward'></span>
                </button>
            </span>
        );
    }
}
