import React, { useRef, useMemo } from 'react';
import UplotReact from 'uplot-react';
import { useResizeDetector } from 'react-resize-detector';
import gettext from 'sources/gettext';
import PropTypes from 'prop-types';
import { useTheme } from '@material-ui/styles';

const removeExistingTooltips = () => {
  // Select all elements with the class name "uplot-tooltip"
  const tooltipLabels = document.querySelectorAll('.uplot-tooltip');

  // Remove each selected element
  tooltipLabels.forEach((tooltipLabel) => {
    tooltipLabel.remove();
  });
};

function formatLabel(ticks) {
  // Format the label
  return ticks.map((value) => {
    if(value < 1){
      return value+'';
    }
    return parseLabel(value);
  });
}

function parseLabel(label) {
  const suffixes = ['', 'k', 'M', 'B', 'T'];
  const suffixNum = Math.floor(Math.log10(label) / 3);
  const shortValue = (label / Math.pow(1000, suffixNum)).toFixed(1);
  return shortValue + ' ' + suffixes[suffixNum];
}

function tooltipPlugin(refreshRate) {
  let tooltipTopOffset = -20;
  let tooltipLeftOffset = 10;
  let tooltip;

  function showTooltip() {
    if(!tooltip) {
      removeExistingTooltips();
      tooltip = document.createElement('div');
      tooltip.className = 'uplot-tooltip';
      tooltip.style.display = 'block';
      document.body.appendChild(tooltip);
    }
  }

  function hideTooltip() {
    tooltip?.remove();
    tooltip = null;
  }

  function setTooltip(u) {
    if(u.cursor.top <= 0) {
      hideTooltip();
      return;
    }
    showTooltip();

    let tooltipHtml=`<div>${(u.data[1].length-1-parseInt(u.legend.values[0]['_'])) * refreshRate + gettext(' seconds ago')}</div>`;
    for(let i=1; i<u.series.length; i++) {
      let _tooltip = parseFloat(u.legend.values[i]['_'].replace(/,/g,''));
      if (_tooltip > 1) _tooltip = parseLabel(_tooltip);
      tooltipHtml += `<div class='uplot-tooltip-label'><div style='height:12px; width:12px; background-color:${u.series[i].stroke()}'></div> ${u.series[i].label}: ${_tooltip}</div>`;
    }
    tooltip.innerHTML = tooltipHtml;

    let overBBox = u.over.getBoundingClientRect();
    let tooltipBBox = tooltip.getBoundingClientRect();
    let left = (tooltipLeftOffset + u.cursor.left + overBBox.left);
    /* Should not outside the graph right */
    if((left+tooltipBBox.width) > overBBox.right) {
      left = left - tooltipBBox.width - tooltipLeftOffset*2;
    }
    tooltip.style.left = left + 'px';
    tooltip.style.top = (tooltipTopOffset + u.cursor.top + overBBox.top) + 'px';
  }

  return {
    hooks: {
      setCursor: [
        u => {
          setTooltip(u);
        }
      ],
    }
  };
}

export default function StreamingChart({xRange=75, data, options, showSecondAxis=false}) {
  const chartRef = useRef();
  const theme = useTheme();
  const { width, height, ref:containerRef } = useResizeDetector();

  const defaultOptions = useMemo(()=> {
    const series = [
      {},
      ...(data.datasets?.map((datum, index) => ({
        label: datum.label,
        stroke: datum.borderColor,
        width: options.lineBorderWidth ?? 1,
        scale: showSecondAxis && (index === 1) ? 'y1' : 'y',
        points: { show: options.showDataPoints ?? false, size: datum.pointHitRadius * 2 },
      })) ?? []),
    ];

    const axes = [
      {
        show: false,
        stroke: theme.palette.text.primary,
      },
    ];

    if(showSecondAxis){
      axes.push({
        scale: 'y',
        grid: {
          stroke: theme.otherVars.borderColor,
          width: 0.5,
        },
        stroke: theme.palette.text.primary,
        size: function(_obj, values) {
          let size = 40;
          if(values?.length > 0) {
            size = values[values.length-1].length*12;
            if(size < 40) size = 40;
          }
          return size;
        },
        // y-axis configuration
        values: (self, ticks) => { return formatLabel(ticks); }
      });
      axes.push({
        scale: 'y1',
        side: 1,
        stroke: theme.palette.text.primary,
        grid: {show: false},
        size: function(_obj, values) {
          let size = 40;
          if(values?.length > 0) {
            size = values[values.length-1].length*12;
            if(size < 40) size = 40;
          }
          return size;
        },
        // y-axis configuration
        values: (self, ticks) => { return formatLabel(ticks); }
      });
    } else{
      axes.push({
        scale: 'y',
        grid: {
          stroke: theme.otherVars.borderColor,
          width: 0.5,
        },
        stroke: theme.palette.text.primary,
        size: function(_obj, values) {
          let size = 40;
          if(values?.length > 0) {
            size = values[values.length-1].length*12;
            if(size < 40) size = 40;
          }
          return size;
        },
        // y-axis configuration
        values: (self, ticks) => { return formatLabel(ticks); }
      });
    }


    return {
      title: '',
      width: width,
      height: height,
      padding: [10, 0, 10, 0],
      focus: {
        alpha: 0.3,
      },
      cursor: {
        y: false,
        drag: {
          setScale: false,
        }
      },
      series: series,
      scales: {
        x: {
          time: false,
        }
      },
      axes: axes,
      plugins: options.showTooltip ? [tooltipPlugin(data.refreshRate)] : [],
    };
  }, [data.refreshRate, data?.datasets?.length, width, height, options]);

  const initialState = [
    Array.from(new Array(xRange).keys()),
    ...(data.datasets?.map((d)=>{
      let ret = [...d.data];
      ret.reverse();
      return ret;
    })??{}),
  ];

  chartRef.current?.setScale('x', {min: data.datasets[0]?.data?.length-xRange, max: data.datasets[0]?.data?.length-1});
  return (
    <div ref={containerRef} style={{width: '100%', height: '100%'}}>
      <UplotReact target={containerRef.current} options={defaultOptions} data={initialState} onCreate={(obj)=>chartRef.current=obj} />
    </div>
  );
}

const propTypeData = PropTypes.shape({
  datasets: PropTypes.array,
  refreshRate: PropTypes.number.isRequired,
});

StreamingChart.propTypes = {
  xRange: PropTypes.number.isRequired,
  data: propTypeData.isRequired,
  options: PropTypes.object,
  showSecondAxis: PropTypes.bool,
};
