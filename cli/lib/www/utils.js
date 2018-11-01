;(utils => {
  let data
  let sortedBatchIds
  let currentBatchId

  const REPO_URL = 'https://github.com/GoogleChrome/lighthouse'
  const noop = () => undefined

  function createElement(parent, tagName, ...restArgs) {
    let id
    let classes
    if (restArgs.length === 1 && typeof restArgs[0] === 'object') {
      id = restArgs[0].id
      classes = restArgs[0].classes || []
    } else {
      classes = restArgs
    }

    const el = document.createElement(tagName)
    el.classList.add(...classes)
    if (id) el.id = id
    if (parent !== document) parent.appendChild(el)
    return el
  }

  /**
   * @see https://stackoverflow.com/questions/16194730/seeking-a-statistical-javascript-function-to-return-p-value-from-a-z-score
   */
  function getZPercentile(z) {
    // z == number of standard deviations from the mean

    // If z is greater than 6.5 standard deviations from the mean just round it off.
    if (z < -6.5) return 0.0
    if (z > 6.5) return 1.0

    var factK = 1
    var sum = 0
    var term = 1
    var k = 0
    var loopStop = Math.exp(-23)
    while (Math.abs(term) > loopStop) {
      term =
        (((0.3989422804 * Math.pow(-1, k) * Math.pow(z, k)) / (2 * k + 1) / Math.pow(2, k)) *
          Math.pow(z, k + 1)) /
        factK
      sum += term
      k++
      factK *= k
    }
    sum += 0.5

    return sum
  }

  function computeStatistics(values) {
    const n = values.length
    const mean = _.sum(values) / n
    const sse = _.sum(values.map(x => Math.pow(x - mean, 2)))
    const variance = sse / (n - 1)
    const stddev = Math.sqrt(variance)
    return {n, mean, sse, variance, stddev}
  }

  async function fetchData() {
    const response = await fetch(`/dashboard-data.json${location.search}`)
    data = await response.json()

    for (const [batchId, batch] of Object.entries(data)) {
      Object.defineProperty(batch, 'metadata', {
        value: batch._metadata,
        enumerable: false,
        writable: false,
      })
      const date = batchId.replace(/^.*?-(\d{4}-\d{2}-\d{2}T)/, '$1')
      batch.metadata.date = new Date(date)
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

    sortedBatchIds = _(data)
      .sortBy(batch => batch.metadata.date.getTime())
      .map(b => b.metadata.batchId)
      .reverse()
      .value()

    currentBatchId = sortedBatchIds[0]

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
        if (!batchValues.length) return

        datasets.push({
          batchId: batchId,
          uiName: data[batchId].metadata.uiName,
          date: data[batchId].metadata.date,

          name: data[batchId].metadata.uiName || data[batchId].metadata.hashDate,
          y: batchValues,
          type: 'box',
        })
      },
    })

    return _.sortBy(datasets, set => set.uiName || set.date.getTime())
  }

  function getHistogramData(prop, opts = {}) {
    if (!opts.where) opts.where = o => o.batchId === currentBatchId

    const datasets = []
    iterateData(prop, {
      ...opts,
      onBatch(batchValues, {batchId}) {
        if (!batchValues.length) return

        datasets.push({
          x: batchValues,
          nbinsx: 8,
          type: 'histogram',
          name: data[batchId].metadata.uiName || data[batchId].metadata.hashDate,
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
    return values.sort((a, b) => a - b)[Math.floor(values.length * 0.99)]
  }

  function getPValue(prop, opts) {
    const valuesA = []
    const valuesB = []
    iterateData(prop, {where: opts.whereA, onURL: (values, {url}) => valuesA.push({values, url})})
    iterateData(prop, {where: opts.whereB, onURL: (values, {url}) => valuesB.push({values, url})})

    if (!valuesA.length || !valuesB.length) return NaN

    const valuesAByURL = _(valuesA)
      .groupBy('url')
      .mapValues(items => _.flatten(items.map(x => x.values)))
      .value()
    const valuesBByURL = _(valuesB)
      .groupBy('url')
      .mapValues(items => _.flatten(items.map(x => x.values)))
      .value()

    const pvalues = {}
    for (const [url, urlValuesA] of Object.entries(valuesAByURL)) {
      const urlValuesB = valuesBByURL[url]

      const statsA = computeStatistics(urlValuesA)
      const statsB = computeStatistics(urlValuesB)

      const meanDifference = statsA.mean - statsB.mean
      const stddevOfSum = Math.sqrt(statsA.variance + statsB.variance)
      const z = meanDifference / stddevOfSum
      const percentile = getZPercentile(z)
      pvalues[url] = Math.min(percentile, 1 - percentile) * 2
    }

    const minEntry = _.minBy(Object.entries(pvalues), '1')
    return minEntry[1] * 100
  }

  function renderEnvironment(opts = {}) {
    const {id = 'environment', batchId = currentBatchId} = opts
    const envEl = document.getElementById(id)
    if (!envEl) return

    const {hash, label, date} = data[batchId].metadata
    const hashLink = `${REPO_URL}/tree/${hash}`

    envEl.classList.add('environment')
    envEl.innerHTML = `
      <div class="row">
        <div class="col-4">Hash: <a target="_blank" href="${hashLink}">${hash.slice(0, 8)}</a></div>
        <div class="col-4">Data Channel: <span>${label}</span></div>
        <div class="col-4">Data Collected: <span>${date.toLocaleString()}</span></div>
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
      // reset any previous state
      el.textContent = ''

      const titleEl = document.createElement('div')
      titleEl.classList.add('title')
      titleEl.textContent = opts.title
      el.appendChild(titleEl)

      const value = dataFn()
      const valueAsString = value.toLocaleString(undefined, {maximumFractionDigits: 1})
      const valueEl = document.createElement('div')
      valueEl.classList.add('value')
      valueEl.textContent = `${valueAsString} ${opts.unit || ''}`
      el.appendChild(valueEl)

      const {warnThreshold, errorThreshold, descendingWarn} = opts
      const isAboveWarn = value >= warnThreshold
      const isAboveError = value >= errorThreshold
      const hasThresholds = Boolean(warnThreshold || errorThreshold)
      const isWarn = (isAboveWarn && !descendingWarn) || (!isAboveWarn && descendingWarn)
      const isError = (isAboveError && !descendingWarn) || (!isAboveError && descendingWarn)

      el.classList.toggle('tile--neutral', !hasThresholds)
      el.classList.toggle('tile--warn', Boolean(hasThresholds && isWarn && !isError))
      el.classList.toggle('tile--error', Boolean(hasThresholds && !!isError))
      el.classList.toggle('tile--success', Boolean(hasThresholds && !isWarn && !isError))
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
    renderEnvironment,
    createElement,
  })
})((window.utils = {}))
