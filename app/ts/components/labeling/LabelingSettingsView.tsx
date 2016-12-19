// The settings (options) view for labeling. 
// FIXME: There's currently no settings for alignment, and some of the settings are shared but all in this file.

import * as Actions from '../../actions/Actions';
import {LabelingSuggestionLogicType, SignalsViewMode} from '../../common/common';
import {labelingSuggestionGenerator} from '../../stores/LabelingSuggestionGenerator';
import * as stores from '../../stores/stores';
import {ConfidenceSlider} from '../common/ConfidenceSlider';
import {EventListenerComponent} from '../common/EventListenerComponent';
import * as React from 'react';


export interface LabelingSettingsViewState {
    suggestionStatus: string;
    suggestionConfidenceThreshold: number;
    suggestionConfidenceHistogram: number[];

    suggestionEnabled: boolean;
    suggestionLogic: LabelingSuggestionLogicType;
    suggestionLogicDescription: string;

    signalsViewMode: SignalsViewMode;
}



export class LabelingSettingsView extends EventListenerComponent<{}, LabelingSettingsViewState> {

    private setSuggestionLogicThunk: {[logicType: number]: () => void} = {};
    private setViewModeThunk: {[viewMode: number]: () => void} = {};

    constructor(props: {}, context: any) {
        super(props, context, [
            stores.labelingUiStore.suggestionConfidenceThresholdChanged,
            stores.labelingUiStore.suggestionProgressChanged,
            stores.labelingUiStore.suggestionEnabledChanged,
            stores.labelingUiStore.suggestionLogicChanged,
            stores.labelingUiStore.signalsViewModeChanged
        ]);
        this.state = this.computeState();

        this.updateState = this.updateState.bind(this);
        this.turnOnSuggestions = this.turnOnSuggestions.bind(this);
        this.turnOffSuggestions = this.turnOffSuggestions.bind(this);
        this.setConfidenceThreshold = this.setConfidenceThreshold.bind(this);

        Object.keys(LabelingSuggestionLogicType).forEach(name => {
            const val = LabelingSuggestionLogicType[name];
            this.setSuggestionLogicThunk[val] = this.setSuggestionLogic.bind(this, val);
        });
        Object.keys(SignalsViewMode).forEach(name => {
            const val = SignalsViewMode[name];
            this.setViewModeThunk[val] = this.setViewMode.bind(this, val);
        });
    }

    public computeState(): LabelingSettingsViewState {
        return {
            suggestionStatus: labelingSuggestionGenerator.modelStatus,
            suggestionConfidenceThreshold: stores.labelingUiStore.suggestionConfidenceThreshold,
            suggestionConfidenceHistogram: stores.labelingUiStore.suggestionConfidenceHistogram,
            suggestionEnabled: stores.labelingUiStore.suggestionEnabled,
            suggestionLogic: stores.labelingUiStore.suggestionLogic.getType(),
            suggestionLogicDescription: stores.labelingUiStore.suggestionLogic.getDescription(),
            signalsViewMode: stores.labelingUiStore.signalsViewMode
        };
    }

    protected updateState(): void {
        this.setState(this.computeState());
    }

    private turnOnSuggestions(): void {
        new Actions.LabelingActions.SetSuggestionEnabled(true).dispatch();
    }

    private turnOffSuggestions(): void {
        new Actions.LabelingActions.SetSuggestionEnabled(false).dispatch();
        new Actions.LabelingActions.RemoveAllSuggestions().dispatch();
    }

    private setConfidenceThreshold(value: number): void {
        new Actions.LabelingActions.SetSuggestionConfidenceThreshold(
            Math.max(0.001, Math.min(0.999, Math.pow(value, 1.0 / 0.3)))).dispatch();
    }

    private setSuggestionLogic(logicType: LabelingSuggestionLogicType): void {
        new Actions.LabelingActions.SetSuggestionLogic(logicType).dispatch();
    }

    private setViewMode(viewMode: SignalsViewMode): void {
        new Actions.LabelingActions.SetSignalsViewMode(viewMode).dispatch();
    }

    public render(): JSX.Element {
        const logicClassName = (log: LabelingSuggestionLogicType) => {
            return this.state.suggestionLogic === log ? 'tbtn-l1 active' : 'tbtn-l3';
        };
        const viewModeClassName = (mode: SignalsViewMode) => {
            return this.state.signalsViewMode === mode ? 'tbtn-l1 active' : 'tbtn-l3';
        };
        return (
            <div className='labeling-options-menu labeling-menu'>
                <h2>Suggestions</h2>
                <p>
                    <span className='tbtn-group'>
                        <button
                            type='button'
                            className={`tbtn ${this.state.suggestionEnabled ? 'tbtn-l1 active' : 'tbtn-l3'}`}
                            onClick={this.turnOnSuggestions}
                            >On</button>
                        <button
                            type='button'
                            className={`tbtn ${!this.state.suggestionEnabled ? 'tbtn-l1 active' : 'tbtn-l3'}`}
                            onClick={this.turnOffSuggestions}
                            >Off</button>
                    </span>
                </p>

                { stores.labelingUiStore.suggestionEnabled ? (
                    <div>
                        <ConfidenceSlider
                            viewWidth={400}
                            viewHeight={50}
                            min={0}
                            max={1}
                            value={Math.pow(this.state.suggestionConfidenceThreshold, 0.3) }
                            histogram={this.state.suggestionConfidenceHistogram}
                            onChange={this.setConfidenceThreshold}
                            />
                        <p>Status: {this.state.suggestionStatus}</p>

                    </div>
                ) : null }

                <h2>Suggestion Logic</h2>
                <p>
                    <span className='tbtn-group'>
                        <button
                            type='button'
                            className={`tbtn ${logicClassName(LabelingSuggestionLogicType.CURRENT_VIEW)}`}
                            onClick={this.setSuggestionLogicThunk[LabelingSuggestionLogicType.CURRENT_VIEW]}
                            >Current View</button>
                        <button
                            type='button'
                            className={`tbtn ${logicClassName(LabelingSuggestionLogicType.FORWARD)}`}
                            onClick={this.setSuggestionLogicThunk[LabelingSuggestionLogicType.FORWARD]}
                            >Forward / Keep</button>
                        <button
                            type='button'
                            className={`tbtn ${logicClassName(LabelingSuggestionLogicType.FORWARD_CONFIRM)}`}
                            onClick={this.setSuggestionLogicThunk[LabelingSuggestionLogicType.FORWARD_CONFIRM]}
                            >Forward / Confirm</button>
                        <button
                            type='button'
                            className={`tbtn ${logicClassName(LabelingSuggestionLogicType.FORWARD_REJECT)}`}
                            onClick={this.setSuggestionLogicThunk[LabelingSuggestionLogicType.FORWARD_REJECT]}
                            >Forward / Reject</button>
                    </span>
                </p>
                <p>{this.state.suggestionLogicDescription}</p>

                <h2>Signals Display</h2>
                <p>
                    <span className='tbtn-group'>
                        <button
                            type='button'
                            className={`tbtn ${viewModeClassName(SignalsViewMode.TIMESERIES)}`}
                            onClick={this.setViewModeThunk[SignalsViewMode.TIMESERIES]}
                            >Time series</button>
                        <button
                            type='button'
                            className={`tbtn ${viewModeClassName(SignalsViewMode.AUTOCORRELOGRAM)}`}
                            onClick={this.setViewModeThunk[SignalsViewMode.AUTOCORRELOGRAM]}
                            >Autocorrelogram</button>
                        <button
                            type='button'
                            className={`tbtn ${viewModeClassName(SignalsViewMode.COMBINED)}`}
                            onClick={this.setViewModeThunk[SignalsViewMode.COMBINED]}
                            >Both</button>
                    </span>
                </p>
            </div>
        );
    }
}
