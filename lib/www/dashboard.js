;(utils => {
  const {
    fetchAndRender,
    getBoxAndWhiskerData,
    getHistogramData,
    get99thValue,
    getAverageValue,
  } = utils

  const graphs = [
    [
      'runtime-box-whisker',
      () => getBoxAndWhiskerData('timing-total'),
      {
        title: 'Runtime Over Time',
        yaxis: {ticksuffix: ' s'},
        xaxis: {
          zeroline: false,
          showticklabels: false,
        },
      },
    ],
    [
      'tti-variance-box-whisker',
      () => getBoxAndWhiskerData('interactive-deltasPercent'),
      {
        title: 'TTI Deltas Over Time',
        yaxis: {ticksuffix: '%'},
        xaxis: {
          zeroline: false,
          showticklabels: false,
        },
      },
    ],
    [
      'runtime-histogram',
      () => getHistogramData('timing-total'),
      {
        title: 'Runtime Distribution',
        xaxis: {ticksuffix: ' s'},
      },
    ],
    [
      'tti-variance-histogram',
      () => getHistogramData('interactive-deltasPercent'),
      {
        title: 'TTI Deltas Distribution',
        xaxis: {ticksuffix: '%'},
      },
    ],
  ]

  const tiles = [
    ['runtime-avg', () => getAverageValue('timing-total'), {title: 'Avg Runtime', unit: 's'}],
    ['runtime-99th', () => get99thValue('timing-total'), {title: '99th Runtime', unit: 's'}],
    [
      'tti-avg',
      () => getAverageValue('interactive-deltasPercent'),
      {title: 'Avg TTI Delta', unit: '%'},
    ],
    [
      'tti-99th',
      () => get99thValue('interactive-deltasPercent'),
      {title: '99th TTI Delta', unit: '%'},
    ],
  ]

  fetchAndRender({graphs, tiles})
})(window.utils)
