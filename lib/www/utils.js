;(utils => {
  let data
  let currentBatchId

  const REPO_URL = 'https://github.com/GoogleChrome/lighthouse'

  async function fetchData() {
    const response = await fetch('/dashboard-data.json')
    data = await response.json()
    currentBatchId = _.last(Object.keys(data).sort())

    for (const [batchId, batch] of Object.entries(data)) {
      Object.defineProperty(batch, 'metadata', {
        value: batch._metadata,
        enumerable: false,
        writable: false,
      })
      const date = batchId.replace(/^.*?-/, '')
      batch.metadata.date = date
      batch.metadata.hashDate = `${batch.metadata.hash.slice(0, 8)}-${date}`
      delete batch._metadata

      for (const [url, properties] of Object.entries(batch)) {
        for (let [propertyName, values] of Object.entries(properties)) {
          if (propertyName.startsWith('timing')) {
            values = values.map(x => x / 1000)
          }

          const n = values.length
          const mean = _.sum(values) / n
          const sse = values.map(x => Math.pow(x - mean, 2))
          const stddev = Math.sqrt(sse / (n - 1))
          const stddevPercent = stddev / mean

          const deltas = values.map(x => x - mean)
          properties[propertyName] = values
          properties[`${propertyName}-deltas`] = deltas
          properties[`${propertyName}-deltasAbsolute`] = deltas.map(x => Math.abs(x))
          properties[`${propertyName}-deltasPercent`] = deltas.map(
            x => Math.round((10000 * Math.abs(x)) / mean) / 100,
          )
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
        name: data[batchId].metadata.hashDate,
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

  function renderEnvironment() {
    const envEl = document.getElementById('environment')
    if (!envEl) return

    const {hash, label, date} = data[currentBatchId].metadata
    const hashLink = `${REPO_URL}/tree/${hash}`

    envEl.innerHTML = `
      <div class="row">
        <div class="col-2"></div>
        <div class="col-3">Hash: <a target="_blank" href="${hashLink}">${hash}</a></div>
        <div class="col-2">Data Channel: <span>${label}</span></div>
        <div class="col-3">Data collected on <span>${date}</span></div>
        <div class="col-2"></div>
      </div>
    `
  }

  function render({graphs, tiles}) {
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
      valueEl.textContent = `${dataFn().toLocaleString(undefined, {
        maximumFractionDigits: 1,
      })} ${opts.unit || ''}`
    }

    renderEnvironment()
  }

  async function fetchAndRender(opts) {
    document.body.classList.add('is-loading')
    await fetchData()
    render(opts)
    document.body.classList.remove('is-loading')
  }

  Object.assign(utils, {
    getBoxAndWhiskerData,
    getHistogramData,
    get99thValue,
    getAverageValue,
    fetchData,
    fetchAndRender,
    render,
  })
})((window.utils = {}))
