;(utils => {
  let data
  let sortedBatchIds
  let currentBatchId

  const REPO_URL = 'https://github.com/GoogleChrome/lighthouse'
  const noop = () => undefined

  function computeStatistics(values) {
    const n = values.length
    const mean = _.sum(values) / n
    const sse = _.sum(values.map(x => Math.pow(x - mean, 2)))
    const variance = sse / (n - 1)
    const stddev = Math.sqrt(variance)
    return {n, mean, sse, variance, stddev}
  }

  async function fetchData() {
    const response = await fetch('/dashboard-data.json')
    data = await response.json()
    sortedBatchIds = Object.keys(data).sort()
    currentBatchId = _.last(sortedBatchIds)

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
          values = values.map(x => x / 1000)

          const {stddev, mean} = computeStatistics(values)
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

    return {currentBatchId, sortedBatchIds, data}
  }

  function iterateData(prop, opts = {}) {
    let {where, onURL = noop, onBatch = noop} = opts

    const allValues = []
    for (const [batchId, batch] of Object.entries(data)) {
      const batchData = {batchId, batch}
      const batchValues = []
      for (const [url, properties] of Object.entries(batch)) {
        const urlData = {...batchData, url, properties}
        if (where && !where(urlData)) continue

        const urlValues = properties[prop]
        onURL(urlValues, urlData)
        batchValues.push(...urlValues)
      }

      onBatch(batchValues, batchData)
      allValues.push(...batchValues)
    }

    return allValues
  }

  function getBoxAndWhiskerData(prop, opts = {}) {
    const datasets = []
    iterateData(prop, {
      ...opts,
      onBatch(batchValues, {batchId}) {
        datasets.push({
          name: data[batchId].metadata.hashDate,
          y: batchValues,
          type: 'box',
        })
      },
    })

    return datasets
  }

  function getHistogramData(prop, opts = {}) {
    if (!opts.where) opts.where = o => o.batchId === currentBatchId

    const datasets = []
    iterateData(prop, {
      ...opts,
      onBatch(batchValues, {batchId}) {
        datasets.push({
          x: batchValues,
          nbinsx: 8,
          type: 'histogram',
          name: data[batchId].metadata.hashDate,
        })
      },
    })

    return datasets
  }

  function getAverageValue(prop, opts = {}) {
    if (!opts.where) opts.where = o => o.batchId === currentBatchId
    const values = iterateData(prop, opts)
    return _.sum(values) / values.length
  }

  function get99thValue(prop, opts = {}) {
    if (!opts.where) opts.where = o => o.batchId === currentBatchId
    const values = iterateData(prop, opts)
    return values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)]
  }

  function getPValue(prop, opts) {
    const valuesA = iterateData(prop, {where: opts.whereA})
    const valuesB = iterateData(prop, {where: opts.whereB})
    const statsA = computeStatistics(valuesA)
    const statsB = computeStatistics(valuesB)
    return (
      (Math.abs(statsA.mean - statsB.mean) / Math.sqrt(statsA.variance + statsB.variance)) * 100
    )
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

  function render({graphs = [], tiles = []}) {
    const layout = {
      showlegend: false,
      margin: {pad: 5},
    }

    for (const [domId, dataFn, layoutOverrides] of graphs) {
      Plotly.newPlot(domId, dataFn(), _.merge(_.cloneDeep(layout), layoutOverrides))
    }

    for (const [domId, dataFn, opts] of tiles) {
      const el = document.getElementById(domId)

      const titleEl = document.createElement('div')
      titleEl.classList.add('title')
      titleEl.textContent = opts.title
      el.appendChild(titleEl)

      const valueAsString = dataFn().toLocaleString(undefined, {maximumFractionDigits: 1})
      const valueEl = document.createElement('div')
      valueEl.classList.add('value')
      valueEl.textContent = `${valueAsString} ${opts.unit || ''}`
      el.appendChild(valueEl)
    }

    renderEnvironment()
    document.body.classList.remove('is-loading')
  }

  async function fetchAndRender(opts) {
    await fetchData()
    render(opts)
  }

  Object.assign(utils, {
    getBoxAndWhiskerData,
    getHistogramData,
    get99thValue,
    getAverageValue,
    getPValue,
    fetchData,
    fetchAndRender,
    render,
  })
})((window.utils = {}))
