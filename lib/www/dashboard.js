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
    () => getBoxAndWhiskerData('interactive'),
    {
      title: 'TTI Over Time',
      xaxis: {
        zeroline: false,
        showticklabels: false,
      },
    },
  ],
  ['runtime-histogram', () => getHistogramData('timing-total'), {title: 'Runtime Distribution'}],
  ['tti-variance-histogram', () => getHistogramData('interactive'), {title: 'TTI Distribution'}],
]

const tiles = [
  ['runtime-avg', () => getAverageValue('timing-total'), {title: 'Avg Runtime'}],
  ['runtime-99th', () => get99thValue('timing-total'), {title: '99th Runtime'}],
  ['tti-avg', () => getAverageValue('interactive'), {title: 'Avg TTI'}],
  ['tti-99th', () => get99thValue('interactive'), {title: '99th TTI'}],
]

async function fetchData() {
  const response = await fetch('/dashboard-data.json')
  data = await response.json()
  currentBatchId = _.last(Object.keys(data).sort())
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

  return allValues.sort((a, b) => a - b)[Math.floor(allValues.length * 0.9)]
}

function render() {
  const layout = {
    showlegend: false,
  }

  for (const [domId, dataFn, layoutOverrides] of graphs) {
    Plotly.newPlot(domId, dataFn(), _.merge(_.cloneDeep(layout), layoutOverrides))
  }

  for (const [domId, dataFn, opts] of tiles) {
    const el = document.getElementById(domId)
    const titleEl = el.querySelector('.title')
    const valueEl = el.querySelector('.value')
    titleEl.textContent = opts.title
    valueEl.textContent = Math.round(dataFn()).toLocaleString()
  }
}

async function fetchAndRender() {
  await fetchData()
  render()
}

fetchAndRender()
