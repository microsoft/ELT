// The toolbar view for labeling.

import * as actions from '../../actions/Actions';
import {Label} from '../../common/common';
import * as stores from '../../stores/stores';
import {EventListenerComponent} from '../common/EventListenerComponent';
import {InlineClassesListView} from './ClassesListView';
import * as React from 'react';



export interface LabelingToolbarViewProps {
    top: number;
    left: number;
    viewWidth: number;
    viewHeight: number;
}

export interface LabelingToolbarViewState {
    labels: Label[];

    suggestionEnabled: boolean;

    timeCursor: number;
}

export class LabelingToolbarView extends EventListenerComponent<LabelingToolbarViewProps, LabelingToolbarViewState> {
    public refs: {
        [name: string]: Element,
        fileSelector: HTMLInputElement
    };

    constructor(props: LabelingToolbarViewProps, context: any) {
        super(props, context, [
            stores.labelingStore.labelsArrayChanged,
            stores.alignmentLabelingUiStore.referenceViewTimeCursorChanged,
            stores.labelingUiStore.suggestionEnabledChanged
        ]);

        this.state = {
            labels: stores.labelingStore.labels,
            suggestionEnabled: stores.labelingUiStore.suggestionEnabled,
            timeCursor: stores.alignmentLabelingUiStore.referenceViewTimeCursor
        };

        this.updateState = this.updateState.bind(this);
    }

    protected updateState(): void {
        this.setState({
            labels: stores.labelingStore.labels,
            suggestionEnabled: stores.labelingUiStore.suggestionEnabled,
            timeCursor: stores.alignmentLabelingUiStore.referenceViewTimeCursor
        });
    }

    public render(): JSX.Element {
        return (
            <div className='labeling-toolbar-view' style={{
                position: 'absolute',
                top: this.props.top + 'px',
                left: this.props.left + 'px',
                width: this.props.viewWidth + 'px',
                height: this.props.viewHeight + 'px'
            }}>
                <button className='tbtn tbtn-l3' title='Zoom in'
                    onClick={ () => new actions.CommonActions.ReferenceViewPanAndZoom(0, -0.2, 'center').dispatch() }>
                    <span className='glyphicon icon-only glyphicon-zoom-in'></span></button>
                {' '}
                <button className='tbtn tbtn-l3' title='Zoom out'
                    onClick={ () => new actions.CommonActions.ReferenceViewPanAndZoom(0, +0.2, 'center').dispatch() }>
                    <span className='glyphicon icon-only glyphicon-zoom-out'></span></button>
                {' '}
                <span className='sep' />
                {' '}
                <button className='tbtn tbtn-l3' title='Go to the beginning'
                    onClick={ () => new actions.CommonActions.ReferenceViewPanAndZoom(-1e10, 0).dispatch() }>
                    <span className='glyphicon icon-only glyphicon-fast-backward'></span></button>
                {' '}
                <button className='tbtn tbtn-l3' title='Go to the previous page'
                    onClick={ () => new actions.CommonActions.ReferenceViewPanAndZoom(-0.6, 0).dispatch() }>
                    <span className='glyphicon icon-only glyphicon-backward'></span></button>
                {' '}
                <button className='tbtn tbtn-l3' title='Go to the next page'
                    onClick={ () => new actions.CommonActions.ReferenceViewPanAndZoom(+0.6, 0).dispatch() }>
                    <span className='glyphicon icon-only glyphicon-forward'></span></button>
                {' '}
                <button className='tbtn tbtn-l3' title='Go to the end'
                    onClick={ () => new actions.CommonActions.ReferenceViewPanAndZoom(+1e10, 0).dispatch() }>
                    <span className='glyphicon icon-only glyphicon-fast-forward'></span></button>
                {' '}
                <span className='sep' />
                {' '}
                <InlineClassesListView />
                {' '}
                <span className='sep' />
                {' '}
                <span>{this.state.labels.length} labels.</span>
                {' '}
                <button className='tbtn tbtn-red' title='Delete all labels'
                    onClick={() => {
                        if (confirm('Are you sure to delete all labels?')) {
                            new actions.LabelingActions.RemoveAllLabels().dispatch();
                        }
                    } }>
                    <span className='glyphicon icon-only glyphicon-trash'></span>
                </button>
                {' '}
                <span className='sep' />
                {' '}
                <span style={{ minWidth: '10em', display: 'inline-block' }}>
                    Cursor: {this.state.timeCursor !== null ? this.state.timeCursor.toFixed(3) : 'null'}
                </span>
                {' '}
                <span className='sep' />
                {' '}
                Suggestions:
                {' '}
                <span className='tbtn-group'>
                    <button
                        type='button'
                        className={`tbtn ${this.state.suggestionEnabled ? 'tbtn-l1 active' : 'tbtn-l3'}`}
                        onClick={ () => new actions.LabelingActions.SetSuggestionEnabled(true).dispatch() }
                        >On</button>
                    <button
                        type='button'
                        className={`tbtn ${!this.state.suggestionEnabled ? 'tbtn-l1 active' : 'tbtn-l3'}`}
                        onClick={ () => {
                            new actions.LabelingActions.SetSuggestionEnabled(false).dispatch();
                            new actions.LabelingActions.RemoveAllSuggestions().dispatch();
                        } }
                        >Off</button>
                </span>
                {' '}
                <button
                    type='button'
                    className='tbtn tbtn-red'
                    title='Confirm all suggested labels'
                    onClick={ () => new actions.LabelingActions.ConfirmVisibleSuggestions().dispatch() }
                    ><span className='glyphicon icon-only glyphicon-ok'></span></button>
            </div>
        );
    }
}
