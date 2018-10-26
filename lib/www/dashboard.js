let label = 'master'
let data
let currentBatchId

const graphs = [
  [
    'runtime-box-whisker',
    () => getBoxAndWhiskerData('timing-total'),
    {
      title: 'Runtime Over Time',
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
  ['runtime-histogram', () => getHistogramData('timing-total'), {title: 'Runtime Distribution'}],
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
  ['runtime-avg', () => getAverageValue('timing-total'), {title: 'Avg Runtime', unit: 'ms'}],
  ['runtime-99th', () => get99thValue('timing-total'), {title: '99th Runtime', unit: 'ms'}],
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

async function fetchData() {
  const response = await fetch('/dashboard-data.json')
  data = await response.json()
  currentBatchId = _.last(Object.keys(data).sort())

  for (const [batchId, batch] of Object.entries(data)) {
    for (const [url, properties] of Object.entries(batch)) {
      for (const [propertyName, values] of Object.entries(properties)) {
        const n = values.length
        const mean = _.sum(values) / n
        const sse = values.map(x => Math.pow(x - mean, 2))
        const stddev = Math.sqrt(sse / (n - 1))
        const stddevPercent = stddev / mean

        const deltas = values.map(x => x - mean)
        properties[`${propertyName}-deltas`] = deltas
        properties[`${propertyName}-deltasAbsolute`] = deltas.map(x => Math.abs(x))
        properties[`${propertyName}-deltasPercent`] = deltas.map(x => (100 * Math.abs(x)) / mean)
        properties[`${propertyName}-mean`] = [mean]
        properties[`${propertyName}-stddev`] = [stddev]
        properties[`${propertyName}-stddevPercent`] = [stddevPercent]
      }
    }
  }
}

function getBoxAndWhiskerData(prop) {
  const datasets = []
  for (const [batchId, _values] of Object.entries(data)) {
    const allValues = []
    for (const [url, values] of Object.entries(_values)) {
      allValues.push(...values[prop])
    }

    datasets.push({
      name: batchId,
      y: allValues,
      type: 'box',
    })
  }

  return datasets
}

function getHistogramData(prop) {
  const allValues = []
  for (const [url, values] of Object.entries(data[currentBatchId])) {
    allValues.push(...values[prop])
  }

  return [
    {
      x: allValues,
      type: 'histogram',
      nbinsx: 8,
    },
  ]
}

function getAverageValue(prop) {
  const allValues = []
  for (const [url, values] of Object.entries(data[currentBatchId])) {
    allValues.push(...values[prop])
  }

  return _.sum(allValues) / allValues.length
}

function get99thValue(prop) {
  const allValues = []
  for (const [url, values] of Object.entries(data[currentBatchId])) {
    allValues.push(...values[prop])
  }

  return allValues.sort((a, b) => a - b)[Math.floor(allValues.length * 0.95)]
}

function render() {
  const layout = {
    showlegend: false,
    margin: {pad: 5},
  }

  for (const [domId, dataFn, layoutOverrides] of graphs) {
    Plotly.newPlot(domId, dataFn(), _.merge(_.cloneDeep(layout), layoutOverrides))
  }

  for (const [domId, dataFn, opts] of tiles) {
    const el = document.getElementById(domId)
    const titleEl = el.querySelector('.title')
    const valueEl = el.querySelector('.value')
    titleEl.textContent = opts.title
    valueEl.textContent = `${Math.round(dataFn()).toLocaleString()} ${opts.unit || ''}`
  }
}

async function fetchAndRender() {
  await fetchData()
  render()
}

fetchAndRender()
