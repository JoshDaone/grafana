import { PlotSeriesConfig } from '../types';
import { ScaleProps, UPlotScaleBuilder } from './UPlotScaleBuilder';
import { SeriesProps, UPlotSeriesBuilder } from './UPlotSeriesBuilder';
import { AxisProps, UPlotAxisBuilder } from './UPlotAxisBuilder';
import { AxisPlacement } from '../config';
import { Cursor, Band } from 'uplot';
import { defaultsDeep } from 'lodash';

export class UPlotConfigBuilder {
  private series: UPlotSeriesBuilder[] = [];
  private axes: Record<string, UPlotAxisBuilder> = {};
  private scales: UPlotScaleBuilder[] = [];
  private bands: Band[] = [];
  private cursor: Cursor | undefined;
  private hasLeftAxis = false;
  private hasBottomAxis = false;

  addAxis(props: AxisProps) {
    props.placement = props.placement ?? AxisPlacement.Auto;

    if (this.axes[props.scaleKey]) {
      this.axes[props.scaleKey].merge(props);
      return;
    }

    // Handle auto placement logic
    if (props.placement === AxisPlacement.Auto) {
      props.placement = this.hasLeftAxis ? AxisPlacement.Right : AxisPlacement.Left;
    }

    switch (props.placement) {
      case AxisPlacement.Left:
        this.hasLeftAxis = true;
        break;
      case AxisPlacement.Bottom:
        this.hasBottomAxis = true;
        break;
    }

    if (props.placement === AxisPlacement.Hidden) {
      props.show = false;
      props.size = 0;
    }

    this.axes[props.scaleKey] = new UPlotAxisBuilder(props);
  }

  getAxisPlacement(scaleKey: string): AxisPlacement {
    const axis = this.axes[scaleKey];
    return axis?.props.placement! ?? AxisPlacement.Left;
  }

  setCursor(cursor?: Cursor) {
    this.cursor = cursor;
  }

  addSeries(props: SeriesProps) {
    this.series.push(new UPlotSeriesBuilder(props));
  }

  getSeries() {
    return this.series;
  }

  /** Add or update the scale with the scale key */
  addScale(props: ScaleProps) {
    const current = this.scales.find(v => v.props.scaleKey === props.scaleKey);
    if (current) {
      current.merge(props);
      return;
    }
    this.scales.push(new UPlotScaleBuilder(props));
  }

  addBand(band: Band) {
    this.bands.push(band);
  }

  getConfig() {
    const config: PlotSeriesConfig = { series: [{}] };
    config.axes = this.ensureNonOverlappingAxes(Object.values(this.axes)).map(a => a.getConfig());
    config.series = [...config.series, ...this.series.map(s => s.getConfig())];
    config.scales = this.scales.reduce((acc, s) => {
      return { ...acc, ...s.getConfig() };
    }, {});

    config.cursor = this.cursor || {};

    // When bands exist, only keep fill when defined
    if (config.bands?.length) {
      config.bands = this.bands;
      const keepFill = new Set<number>();
      for (const b of config.bands) {
        keepFill.add(b.series[0]);
      }
      for (let i = 1; i < config.series.length; i++) {
        if (!keepFill.has(i)) {
          config.series[i].fill = undefined;
        }
      }
    }

    const cursorDefaults: Cursor = {
      // prevent client-side zoom from triggering at the end of a selection
      drag: { setScale: false },
      points: {
        /*@ts-ignore*/
        size: (u, seriesIdx) => u.series[seriesIdx].points.size * 2,
        /*@ts-ignore*/
        width: (u, seriesIdx, size) => size / 4,
        /*@ts-ignore*/
        stroke: (u, seriesIdx) => u.series[seriesIdx].points.stroke(u, seriesIdx) + '80',
        /*@ts-ignore*/
        fill: (u, seriesIdx) => u.series[seriesIdx].points.stroke(u, seriesIdx),
      },
      focus: {
        prox: 30,
      },
    };

    defaultsDeep(config.cursor, cursorDefaults);

    return config;
  }

  private ensureNonOverlappingAxes(axes: UPlotAxisBuilder[]): UPlotAxisBuilder[] {
    for (const axis of axes) {
      if (axis.props.placement === AxisPlacement.Right && this.hasLeftAxis) {
        axis.props.grid = false;
      }
      if (axis.props.placement === AxisPlacement.Top && this.hasBottomAxis) {
        axis.props.grid = false;
      }
    }

    return axes;
  }
}
