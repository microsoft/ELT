// Global layout parameters.
// TODO: make this as a state of the app, as we might want to allow users to adjust view sizes in the future.

export module LayoutParameters {
    export let svgXPadding1 = 8;
    export let svgXPadding2 = 8 + 20;
    export let svgYPadding1 = 25;
    export let svgYPadding2 = 8;
    export let toolbarViewHeight = 40;

    export let referenceOverviewViewHeight = 100;
    export let referenceOverviewViewVideoHeight = 50;

    export let referenceDetailedViewHeightLabeling = 250;
    export let referenceDetailedViewHeightAlignment = 250;

    export let seriesColorScale = (x) => 'rgba(0, 0, 0, 0.5)';

    export let alignmentTrackHeight = 150;
    export let alignmentTrackMinimizedHeight = 40;
    export let alignmentTrackYOffset = 50;
    export let alignmentTrackGap = 40;
}
